/**
 * aiNyayaBotService.js
 * NyayaBot AI logic — jurisdiction-aware, persona-aware, multi-language
 *
 * Uses aiProvider abstraction:
 *   AI_PROVIDER=gemini  → Gemini 2.5 Flash (dev, free)
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
    const JurisdictionRule = require('../models/JurisdictionRule');
    const LegalAct = require('../models/LegalAct');

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
      const Document = require('../models/Document');
      const doc = await Document.findById(contextRefId).select('title template content').lean();
      if (!doc) return '';
      return `The user has an existing document: "${doc.title}". Tailor your advice to this document context.`;
    }
    if (contextType === 'case') {
      const CaseTracker = require('../models/CaseTracker');
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

function parseNyayaBotResponse(rawText) {
  const attempt = (json) => {
    const parsed = JSON.parse(json);
    const content = parsed.content;
    return {
      content: (typeof content === 'string' && content.trim()) ? content : rawText,
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      suggestedTemplates: Array.isArray(parsed.suggestedTemplates) ? parsed.suggestedTemplates : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
      disclaimer: parsed.disclaimer || defaultDisclaimer('en'),
    };
  };

  const text = rawText.trim();

  // 1. Pure JSON (ideal path)
  try { return attempt(text); } catch (_) {}

  // 2. Code-fenced JSON (```json ... ```)
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return attempt(fence[1].trim()); } catch (_) {}
  }

  // 3. JSON embedded in preamble/postamble text — Gemini thinking models
  //    sometimes add a sentence before or after the JSON block.
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return attempt(text.slice(start, end + 1)); } catch (_) {}
  }

  // 4. Fallback: display raw text (no structure extracted)
  return {
    content: rawText,
    citations: [],
    suggestedTemplates: [],
    followUpQuestions: [],
    disclaimer: defaultDisclaimer('en'),
  };
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
    const rawResponse = await aiProvider.chat(
      [
        ...conversationHistory,
        { role: 'user', content: userQuery },
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
    const DocumentTemplate = require('../models/DocumentTemplate');
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
};
