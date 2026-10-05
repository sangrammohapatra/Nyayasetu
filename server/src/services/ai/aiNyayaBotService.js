/**
 * aiNyayaBotService.js
 * NyayaBot AI logic — jurisdiction-aware, persona-aware, multi-language
 *
 * Uses aiProvider abstraction:
 *   AI_PROVIDER=ollama  → local Ollama (dev)
 *   AI_PROVIDER=gemini  → Gemini 2.5 Flash
 *   AI_PROVIDER=claude  → Claude Sonnet 4  (prod, paid)
 */

const aiProvider = require('./aiProvider');
const logger = require('../../utils/logger');

// ─── Persona system prompts ───────────────────────────────────────────────────

const PERSONA_INSTRUCTIONS = {
  citizen: `You are NyayaBot, a friendly and empathetic legal assistant for NyayaSetu.
You help ordinary Indian citizens understand their legal rights in simple, accessible language.
Your users may have little or no legal knowledge. Speak to them as a knowledgeable friend, not a formal lawyer.
Always:
- Explain legal concepts in plain language FIRST, then add formal terms in parentheses
- Cite exact Indian laws with section numbers (e.g., "Section 138 of the Negotiable Instruments Act, 1881")
- Mention which court or authority the user should approach
- Include estimated fees, timelines, and required documents when relevant
- End responses with a gentle reminder that NyayaBot is not a substitute for a qualified lawyer`,

  lawyer: `You are NyayaBot, a sophisticated AI legal research assistant for NyayaSetu.
You assist Indian advocates and legal professionals with case research, legal analysis, and precedent lookup.
Your users are trained lawyers. Use precise legal terminology. 
Always:
- Cite Acts, sections, and sub-sections with full accuracy
- Reference landmark Supreme Court and High Court judgments when applicable
- Mention the Indian Kanoon URL for case law citations
- Analyse jurisdiction-specific procedural requirements
- Highlight recent amendments or judicial interpretations`,


};

// ─── Language instructions ───────────────────────────────────────────────────

const LANGUAGE_INSTRUCTIONS = {
  hi: 'Respond primarily in Hindi (Devanagari script). Use simple, everyday Hindi. Legal terms may be kept in English with Hindi explanation in parentheses.',
  bn: 'Respond primarily in Bengali (Bangla script). Use clear, simple Bengali.',
  mr: 'Respond primarily in Marathi (Devanagari script). Use clear, conversational Marathi.',
  ta: 'Respond primarily in Tamil script. Use accessible Tamil.',
  te: 'Respond primarily in Telugu script.',
  gu: 'Respond primarily in Gujarati script.',
  kn: 'Respond primarily in Kannada script.',
  ml: 'Respond primarily in Malayalam script.',
  pa: 'Respond primarily in Punjabi (Gurmukhi script).',
  ur: 'Respond primarily in Urdu (Nastaliq script).',
  en: 'Respond in clear, simple English.',
};

// ─── Jurisdiction context loader ─────────────────────────────────────────────

async function loadJurisdictionContext(jurisdiction) {
  if (!jurisdiction) return '';
  try {
    const JurisdictionRule = require('../../models/JurisdictionRule.model');
    const LegalAct = require('../../models/LegalAct.model');

    const rules = await JurisdictionRule.find({ state: jurisdiction }).limit(8).lean();
    const actIds = [...new Set(rules.flatMap((r) => r.applicableActs || []))];
    const acts = await LegalAct.find({ _id: { $in: actIds } })
      .select('shortName fullName year type')
      .limit(10)
      .lean();

    if (!acts.length) return `State jurisdiction: ${jurisdiction}`;

    const actList = acts.map((a) => `${a.shortName} (${a.year})`).join(', ');
    return `User is in ${jurisdiction}. Applicable laws include: ${actList}. Always prefer state-specific procedures where they differ from central law.`;
  } catch (err) {
    logger.warn('aiNyayaBotService: Could not load jurisdiction context', { err: err.message });
    return `User jurisdiction: ${jurisdiction}`;
  }
}

// ─── Context from linked document or case ────────────────────────────────────

async function loadContextSnippet(contextType, contextRefId) {
  if (!contextType || contextType === 'general' || !contextRefId) return '';
  try {
    if (contextType === 'document') {
      const Document = require('../../models/Document.model');
      const doc = await Document.findById(contextRefId).select('title template content').lean();
      if (!doc) return '';
      return `The user has an existing document: "${doc.title}". Tailor your advice to this document context.`;
    }
    if (contextType === 'case') {
      const CaseTracker = require('../../models/CaseTracker.model');
      const c = await CaseTracker.findById(contextRefId).select('caseTitle cnrNumber court state').lean();
      if (!c) return '';
      return `The user is tracking case "${c.caseTitle}" (CNR: ${c.cnrNumber}) at ${c.court}, ${c.state}. Use this as context.`;
    }
  } catch (err) {
    logger.warn('aiNyayaBotService: Could not load context snippet', { err: err.message });
  }
  return '';
}

// ─── Build conversation history for AI ───────────────────────────────────────

function buildConversationHistory(messages) {
  // Keep last 12 messages to stay within token limits
  const recent = messages.slice(-12);
  return recent.map((m) => ({
    role: m.role === 'nyayabot' ? 'assistant' : 'user',
    content: m.content,
  }));
}

// ─── Response schema enforcer ─────────────────────────────────────────────────

function emptyNyayaBotResponse(content) {
  return {
    content: content || '',
    citations: [],
    suggestedTemplates: [],
    followUpQuestions: [],
    disclaimer: defaultDisclaimer('en'),
  };
}

/** Turn leftover JSON escapes (\\n, \\t, \\") into real characters. */
function unescapeLiteralEscapes(value) {
  if (typeof value !== 'string' || !/\\[nrt"\\]/.test(value)) return value;
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function looksLikeEnvelope(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('{') && /"content"\s*:/.test(trimmed);
}

function cleanCitations(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((c) => {
    if (!c || typeof c !== 'object') return false;
    if (typeof c.act !== 'string' || !c.act.trim()) return false;
    if (c.year != null && (typeof c.year !== 'number' || c.year < 1800 || c.year > 2100)) return false;
    return Boolean(c.section || c.fullName);
  });
}

function asObjectArray(list) {
  return Array.isArray(list) ? list.filter((item) => item && typeof item === 'object') : [];
}

function asStringArray(list) {
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string' && item.trim()) : [];
}

/**
 * Close a truncated JSON value so JSON.parse can recover the fields that
 * were already complete (typical when Gemini hits maxOutputTokens mid-object).
 */
function repairJson(json) {
  let s = String(json).trim().replace(/^\uFEFF/, '');
  s = s.replace(/,\s*([}\]])/g, '$1');

  const stack = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) stack.pop();
  }

  if (escape) s = s.slice(0, -1);
  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  s = s.replace(/,\s*"[^"\\]*"\s*:\s*$/, '');
  s = s.replace(/,\s*"[^"\\]*"\s*$/, '');
  while (stack.length) s += stack.pop();
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s;
}

function tryParseJson(json) {
  try {
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function extractStringField(text, field) {
  const match = new RegExp(`"${field}"\\s*:`).exec(text);
  if (!match) return null;
  let i = match.index + match[0].length;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (text[i] !== '"') return null;
  i += 1;

  let out = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const next = text[i + 1];
      if (next == null) break;
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      const map = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\', '/': '/' };
      out += Object.prototype.hasOwnProperty.call(map, next) ? map[next] : next;
      i += 2;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
    i += 1;
  }
  return out.trim() ? out : null;
}

function extractBalanced(text, start) {
  const stack = [];
  let inString = false;
  let escape = false;
  const open = text[start];
  if (open !== '{' && open !== '[') return null;
  stack.push(open === '{' ? '}' : ']');

  for (let i = start + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if ((ch === '}' || ch === ']') && stack[stack.length - 1] === ch) {
      stack.pop();
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function extractJsonValue(text, field) {
  const match = new RegExp(`"${field}"\\s*:`).exec(text);
  if (!match) return null;
  let i = match.index + match[0].length;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (text[i] !== '[' && text[i] !== '{') return null;
  const slice = extractBalanced(text, i);
  if (!slice) return null;
  return tryParseJson(slice) || tryParseJson(repairJson(slice));
}

function fromParsedObject(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  let content = parsed.content;
  if (typeof content === 'string' && looksLikeEnvelope(content)) {
    const inner = tryParseJson(content.trim()) || tryParseJson(repairJson(content.trim()));
    if (inner) {
      const unwrapped = fromParsedObject(inner);
      if (unwrapped) return unwrapped;
    }
  }

  if (typeof content !== 'string' || !content.trim()) return null;

  const disclaimer = typeof parsed.disclaimer === 'string' && parsed.disclaimer.trim()
    ? unescapeLiteralEscapes(parsed.disclaimer)
    : defaultDisclaimer('en');

  return {
    content: unescapeLiteralEscapes(content),
    citations: cleanCitations(parsed.citations),
    suggestedTemplates: asObjectArray(parsed.suggestedTemplates),
    followUpQuestions: asStringArray(parsed.followUpQuestions),
    disclaimer,
  };
}

function salvageFromText(text) {
  const content = extractStringField(text, 'content');
  if (!content || !content.trim()) return null;
  const disclaimer = extractStringField(text, 'disclaimer');
  return {
    content,
    citations: cleanCitations(extractJsonValue(text, 'citations')),
    suggestedTemplates: asObjectArray(extractJsonValue(text, 'suggestedTemplates')),
    followUpQuestions: asStringArray(extractJsonValue(text, 'followUpQuestions')),
    disclaimer: disclaimer || defaultDisclaimer('en'),
  };
}

function parseNyayaBotResponse(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return emptyNyayaBotResponse(typeof rawText === 'string' ? rawText : '');
  }

  const text = rawText.trim();
  const direct = fromParsedObject(tryParseJson(text));
  if (direct) return direct;

  const repairedWhole = fromParsedObject(tryParseJson(repairJson(text)));
  if (repairedWhole) {
    logger.warn('aiNyayaBotService: recovered structured reply from malformed model JSON', {
      chars: text.length,
    });
    return repairedWhole;
  }

  const candidates = [];

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());

  const start = text.indexOf('{');
  if (start !== -1) {
    const end = text.lastIndexOf('}');
    if (end > start) candidates.push(text.slice(start, end + 1));
    candidates.push(text.slice(start));
  }

  for (const candidate of candidates) {
    const normalized = fromParsedObject(tryParseJson(candidate) || tryParseJson(repairJson(candidate)));
    if (normalized) {
      logger.warn('aiNyayaBotService: recovered structured reply from malformed model JSON', {
        chars: text.length,
      });
      return normalized;
    }
  }

  const salvaged = salvageFromText(start === -1 ? text : text.slice(start));
  if (salvaged) {
    logger.warn('aiNyayaBotService: extracted reply text from unparsable model JSON', {
      chars: text.length,
    });
    return salvaged;
  }

  return emptyNyayaBotResponse(unescapeLiteralEscapes(text));
}

function defaultDisclaimer(language) {
  const d = {
    en: 'NyayaBot provides general legal information, not legal advice. For your specific situation, please consult a qualified lawyer.',
    hi: 'NyayaBot सामान्य कानूनी जानकारी प्रदान करता है, कानूनी सलाह नहीं। अपनी विशेष स्थिति के लिए कृपया किसी योग्य वकील से परामर्श करें।',
  };
  return d[language] || d.en;
}

// ─── Main response generator ──────────────────────────────────────────────────

/**
 * generateNyayaBotResponse
 * @param {Object} params
 * @param {string}   params.userQuery       - latest user message
 * @param {Array}    params.messageHistory  - previous messages in session
 * @param {string}   params.persona         - 'citizen' | 'lawyer'
 * @param {string}   params.language        - 'en' | 'hi' | ...
 * @param {string}   params.jurisdiction    - state code or null
 * @param {string}   params.contextType     - 'general' | 'document' | 'case' | ...
 * @param {string}   params.contextRefId    - ObjectId string or null
 * @returns {Promise<Object>} parsed NyayaBot response
 */
async function generateNyayaBotResponse(params) {
  const {
    userQuery,
    messageHistory = [],
    persona = 'citizen',
    language = 'en',
    jurisdiction = null,
    contextType = 'general',
    contextRefId = null,
  } = params;

  // Load contextual data in parallel
  const [jurisdictionCtx, contextSnippet] = await Promise.all([
    loadJurisdictionContext(jurisdiction),
    loadContextSnippet(contextType, contextRefId),
  ]);

  const langInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
  const personaInstruction = PERSONA_INSTRUCTIONS[persona] || PERSONA_INSTRUCTIONS.citizen;

  const systemPrompt = `${personaInstruction}

LANGUAGE INSTRUCTION: ${langInstruction}

${jurisdictionCtx ? `JURISDICTION CONTEXT:\n${jurisdictionCtx}` : ''}
${contextSnippet ? `USER CONTEXT:\n${contextSnippet}` : ''}

RESPONSE FORMAT:
Always reply with a JSON object (no markdown fences needed) in this exact structure:
{
  "content": "<your main response — markdown supported, use **bold** for key terms>",
  "citations": [
    { "act": "short act name", "year": 1986, "fullName": "full act name", "section": "Section XX", "url": "https://indiankanoon.org/..." }
  ],
  "suggestedTemplates": [
    { "slug": "consumer_complaint", "title": "Consumer Complaint", "category": "consumer", "complexity": "moderate", "pricePayPerDoc": 9900 }
  ],
  "followUpQuestions": ["question 1?", "question 2?", "question 3?"],
  "disclaimer": "one-sentence disclaimer in the response language"
}

RULES:
1. citations array: include ONLY when you cite a specific Act/Section. Max 4 citations.
2. suggestedTemplates: include ONLY when the user's query clearly relates to a document type available on NyayaSetu. Max 3 templates.
3. followUpQuestions: always include 2-3 short follow-up questions to deepen engagement.
4. Keep content responses under 400 words. Be concise, clear, actionable.
5. NEVER fabricate laws, sections, or case citations. If unsure, say so.
6. For criminal matters, always emphasise urgency and recommend engaging a lawyer immediately.`;

  const conversationHistory = buildConversationHistory(messageHistory);

  try {
    // Wrap in a role-separation envelope so injection attempts ("ignore prior instructions")
    // sit inside a labelled slot the system prompt explicitly governs, not at top-level.
    const wrappedQuery = `User question (respond accurately only to legal queries): ${userQuery}`;
    const rawResponse = await aiProvider.chat(
      [
        ...conversationHistory,
        { role: 'user', content: wrappedQuery },
      ],
      systemPrompt,
      false,
      true  // jsonMode: force Gemini to return raw JSON without preamble
    );

    const parsed = parseNyayaBotResponse(rawResponse);

    // If disclaimer is missing, add default
    if (!parsed.disclaimer) {
      parsed.disclaimer = defaultDisclaimer(language);
    }

    return parsed;
  } catch (err) {
    logger.error('aiNyayaBotService: generation failed', { error: err.message });
    throw new Error('NyayaBot could not generate a response. Please try again.');
  }
}

// ─── Greeting generator (used on session create) ──────────────────────────────

async function generateGreeting(persona, language, userName) {
  const greetings = {
    en: {
      citizen: `Namaskar${userName ? `, ${userName}` : ''}! 🙏 I'm **NyayaBot**, your AI legal assistant on NyayaSetu.\n\nI can help you understand your legal rights, find the right document to file, track your court cases, or connect you with a verified lawyer. What legal question can I help you with today?`,
      lawyer: `Welcome${userName ? `, Adv. ${userName}` : ''}! I'm **NyayaBot**, your AI legal research assistant on NyayaSetu.\n\nI can assist with case research, precedent lookup, drafting support, and jurisdiction-specific procedures. How can I assist you today?`,
    },
    hi: {
      citizen: `नमस्कार${userName ? `, ${userName}` : ''}! 🙏 मैं **NyayaBot** हूं, NyayaSetu पर आपका AI कानूनी सहायक।\n\nमैं आपके कानूनी अधिकार समझने में, सही दस्तावेज़ दाखिल करने में, और वकील से जोड़ने में मदद कर सकता हूं। आज आप क्या जानना चाहते हैं?`,
      lawyer: `स्वागत है${userName ? `, अधिवक्ता ${userName}` : ''}! मैं **NyayaBot** हूं। कानूनी शोध, मिसाल खोज, और मसौदा तैयार करने में मैं आपकी सहायता कर सकता हूं।`,
    },
  };

  const langGreetings = greetings[language] || greetings.en;
  return langGreetings[persona] || langGreetings.citizen;
}

// ─── Suggest document templates based on query (keyword fallback) ─────────────

async function suggestTemplatesForQuery(query) {
  const q = query.toLowerCase();
  const map = [
    { keywords: ['notice', 'landlord', 'rent', 'eviction', 'tenant'], slugs: ['legal_notice_landlord', 'landlord_eviction'] },
    { keywords: ['consumer', 'product', 'defective', 'service', 'refund', 'company'], slugs: ['consumer_complaint'] },
    { keywords: ['rti', 'information', 'government', 'right to information'], slugs: ['rti_application'] },
    { keywords: ['job', 'fired', 'termination', 'employment', 'notice period', 'salary'], slugs: ['employment_termination', 'labour_dispute'] },
    { keywords: ['bail', 'arrest', 'police', 'fir', 'crime', 'accused'], slugs: ['bail_application', 'police_complaint'] },
    { keywords: ['divorce', 'separation', 'marriage', 'spouse', 'alimony', 'maintenance'], slugs: ['divorce_petition'] },
    { keywords: ['domestic violence', 'abuse', 'harassment', 'dv act', 'protection order'], slugs: ['domestic_violence_complaint'] },
    { keywords: ['cheque', 'bounced', 'dishonour', 'ni act', 'negotiable'], slugs: ['cheque_bounce_notice'] },
    { keywords: ['property', 'sale', 'purchase', 'land', 'flat', 'agreement'], slugs: ['property_sale_agreement'] },
    { keywords: ['power of attorney', 'poa', 'authorise', 'authorize'], slugs: ['power_of_attorney'] },
    { keywords: ['insurance', 'claim', 'policy', 'insurer', 'irda'], slugs: ['insurance_claim'] },
    { keywords: ['startup', 'founders', 'co-founder', 'equity', 'shares'], slugs: ['startup_founders_agreement'] },
  ];

  const matchedSlugs = new Set();
  for (const { keywords, slugs } of map) {
    if (keywords.some((k) => q.includes(k))) {
      slugs.forEach((s) => matchedSlugs.add(s));
    }
  }

  if (!matchedSlugs.size) return [];

  try {
    const DocumentTemplate = require('../../models/DocumentTemplate.model');
    const templates = await DocumentTemplate.find({ slug: { $in: [...matchedSlugs] } })
      .select('slug title category complexity pricePayPerDoc')
      .limit(3)
      .lean();
    return templates.map((t) => ({
      slug: t.slug,
      title: t.title,
      category: t.category,
      complexity: t.complexity,
      pricePayPerDoc: t.pricePayPerDoc,
    }));
  } catch (_) {
    return [];
  }
}

module.exports = {
  generateNyayaBotResponse,
  generateGreeting,
  suggestTemplatesForQuery,
  defaultDisclaimer,
  parseNyayaBotResponse,
};
