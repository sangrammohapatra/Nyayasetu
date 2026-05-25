const { chat }  = require('./aiProvider');
const logger    = require('../../utils/logger');

// ─── Language display names ────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi (हिंदी)',
  bn: 'Bengali (বাংলা)',
  mr: 'Marathi (मराठी)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  gu: 'Gujarati (ગુજરાતી)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  ur: 'Urdu (اردو)',
};

// Languages that use right-to-left script or need special script instructions
const RTL_LANGUAGES = ['ur'];
const DEVANAGARI_LANGUAGES = ['hi', 'mr'];

// ─── System prompt builder ─────────────────────────────────────────────────────

/**
 * buildSystemPrompt — constructs the instruction context for the data-collection
 * AI assistant. This prompt is passed as the system instruction on every turn.
 *
 * @param {object} template        — DocumentTemplate document
 * @param {object} session         — ChatSession document
 * @param {object} jurisdictionRule — JurisdictionRule for user's state (may be null)
 */
function buildSystemPrompt(template, session, jurisdictionRule) {
  const language    = session.userLanguage || 'en';
  const langName    = LANGUAGE_NAMES[language] || 'English';
  const state       = session.userState || 'India';
  const collectedData = session.toCollectedDataObject
    ? session.toCollectedDataObject()
    : (session.collectedData instanceof Map
        ? Object.fromEntries(session.collectedData)
        : session.collectedData || {});

  // Build list of remaining required fields
  const requiredFields = (template.questionFlow || [])
    .filter((q) => q.isRequired)
    .map((q) => q.key);

  const collectedKeys  = Object.keys(collectedData);
  const remainingFields = requiredFields.filter((k) => !collectedKeys.includes(k));

  // Format collected data as readable pairs for the AI context
  const collectedSummary = collectedKeys.length > 0
    ? collectedKeys.map((k) => {
        const question = (template.questionFlow || []).find((q) => q.key === k);
        const label    = question?.label || k;
        return `  • ${label}: ${collectedData[k]}`;
      }).join('\n')
    : '  (none yet)';

  // Format remaining fields with their question text
  const remainingList = remainingFields.length > 0
    ? remainingFields.map((k) => {
        const question = (template.questionFlow || []).find((q) => q.key === k);
        return `  • ${k}${question?.label ? ` (${question.label})` : ''}`;
      }).join('\n')
    : '  (all required fields collected)';

  // Jurisdiction info
  const filingAuthority = jurisdictionRule?.filingAuthority?.name
    || `relevant authority in ${state}`;

  const primaryActs = jurisdictionRule?.applicableActs?.length
    ? jurisdictionRule.applicableActs
        .map((a) => a.actShortName || a.act?.shortName || 'relevant act')
        .filter(Boolean)
        .join(', ')
    : 'applicable Indian laws';

  // Script-specific instructions
  const scriptInstructions = DEVANAGARI_LANGUAGES.includes(language)
    ? `\n- You MUST respond entirely in ${langName} using Devanagari script. No Roman transliteration.`
    : RTL_LANGUAGES.includes(language)
    ? `\n- You MUST respond entirely in ${langName}. Use correct Urdu script (Nastaliq).`
    : language !== 'en'
    ? `\n- You MUST respond entirely in ${langName}. Do not mix English unless it is a proper noun.`
    : '';

  return `You are NyayaSetu, a compassionate and patient Indian legal assistant. Your role is to help ordinary citizens create legal documents by collecting information through friendly conversation.

CURRENT TASK: Collecting information to draft a "${template.name}".

JURISDICTION CONTEXT:
- State: ${state}
- Filing authority: ${filingAuthority}
- Applicable law: ${primaryActs}

INFORMATION COLLECTED SO FAR:
${collectedSummary}

INFORMATION STILL NEEDED:
${remainingList}

CONVERSATION LANGUAGE: ${langName}

STRICT RULES — follow these exactly:
1. Ask ONLY ONE question at a time. Never ask multiple questions in one message.
2. Be warm, empathetic, and conversational. The user may be in distress (domestic violence, job loss, cheated by seller). Acknowledge their situation briefly before asking questions.
3. Use SIMPLE, everyday language. Avoid legal jargon. If a legal term is unavoidable, explain it in one plain sentence.
4. If the user provides multiple pieces of information in one message, extract ALL of them silently, then ask the next missing field.
5. If the user's answer is unclear or incomplete, gently ask for clarification once.
6. Do NOT reveal internal field names (like "complainant_name") to the user. Use natural phrasing.
7. When ALL required fields listed in "INFORMATION STILL NEEDED" are collected, respond ONLY with this exact JSON and nothing else:
   {"dataComplete": true, "summary": "Brief 1-sentence summary of the case for the user"}
8. Never fabricate information. Only use what the user provides.
9. Keep responses concise — max 3 sentences for questions, max 5 sentences for acknowledgements.${scriptInstructions}`;
}

// ─── Field extraction ──────────────────────────────────────────────────────────

/**
 * extractFieldsFromResponse — attempts to extract structured field values from
 * the AI's response text using the template's question flow as a guide.
 *
 * This is a best-effort extraction — the primary source of truth is the AI's
 * own dataComplete JSON signal. This extraction helps update progressPercent
 * incrementally during the conversation.
 *
 * @param {string} responseText
 * @param {Array}  questionFlow    — template.questionFlow
 * @param {object} existingData    — already collected fields
 * @returns {{ fields: object, isComplete: boolean, summary: string|null }}
 */
function extractFieldsFromResponse(responseText, questionFlow, existingData) {
  const text = responseText.trim();

  // ── Check for dataComplete signal ─────────────────────────────────────────
  // The AI should output ONLY the JSON when done — but sometimes wraps it
  // Look for the JSON anywhere in the response
  const jsonMatch = text.match(/\{[^{}]*"dataComplete"\s*:\s*true[^{}]*\}/s) ||
                    text.match(/\{[^{}]*"dataComplete"\s*:\s*true[^{}]*"summary"[^{}]*\}/s);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.dataComplete === true) {
        return {
          fields:     {},
          isComplete: true,
          summary:    parsed.summary || null,
        };
      }
    } catch {
      // Not valid JSON — fall through
    }
  }

  // Also check if the entire response is the completion JSON
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.dataComplete === true) {
        return {
          fields:     {},
          isComplete: true,
          summary:    parsed.summary || null,
        };
      }
    } catch {
      // Not JSON — fall through
    }
  }

  // ── Incremental field extraction is handled by the controller ─────────────
  // The AI drives what fields have been collected via its context window.
  // We rely on the session's collectedData (set by controller) for tracking.
  // Return empty extraction here — do not attempt regex-based field parsing
  // as it's error-prone across 11 languages.
  return { fields: {}, isComplete: false, summary: null };
}

// ─── getNextQuestion ──────────────────────────────────────────────────────────

/**
 * getNextQuestion — the primary function called by the chat controller.
 *
 * Sends the conversation history to the AI and returns the response stream
 * along with extracted field data and completion status.
 *
 * @param {object} session         — ChatSession document (with messages, collectedData)
 * @param {object} template        — DocumentTemplate document
 * @param {object} jurisdictionRule — JurisdictionRule (may be null for some templates)
 * @returns {Promise<{
 *   stream:          AsyncGenerator<string>,
 *   isComplete:      boolean,
 *   summary:         string|null,
 *   extractedFields: object,
 * }>}
 */
async function getNextQuestion(session, template, jurisdictionRule) {
  const systemPrompt = buildSystemPrompt(template, session, jurisdictionRule);

  // Convert session messages to the shared format
  // session.messages uses {role, content} which matches our format
  const messages = (session.messages || [])
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  if (messages.length === 0) {
    // First turn — inject a seed user message so the AI knows to start
    messages.push({
      role:    'user',
      content: `I need help creating a ${template.name}. Please guide me through the process.`,
    });
  }

  logger.debug(`[questionEngine] getNextQuestion for session ${session._id}, template: ${template.slug}, msgs: ${messages.length}`);

  let fullResponseText = '';

  try {
    // Always stream so the controller can push SSE to the client in real time
    const stream = await chat(messages, systemPrompt, true);

    // Wrap the stream to accumulate text for post-processing
    const questionFlow = template.questionFlow || [];
    const existingData = session.toCollectedDataObject
      ? session.toCollectedDataObject()
      : {};

    async function* wrappedStream() {
      for await (const delta of stream) {
        fullResponseText += delta;
        yield delta;
      }
    }

    // Return the generator immediately — caller pipes it to SSE
    // isComplete and extractedFields are resolved lazily after stream ends
    // The controller calls extractFieldsFromResponse after consuming the stream

    return {
      stream:          wrappedStream(),
      // These are resolved by the controller after the stream is consumed:
      getExtractionResult: () =>
        extractFieldsFromResponse(fullResponseText, questionFlow, existingData),
      getFullText: () => fullResponseText,
    };
  } catch (err) {
    logger.error(`[questionEngine] getNextQuestion failed: ${err.message}`, {
      sessionId:    session._id,
      templateSlug: template.slug,
    });
    throw err;
  }
}

// ─── Exported helpers (used by controller for non-stream extraction) ───────────

module.exports = {
  getNextQuestion,
  extractFieldsFromResponse,
  buildSystemPrompt,
};
