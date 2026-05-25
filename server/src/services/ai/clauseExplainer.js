const { chat, generate } = require('./aiProvider');
const logger             = require('../../utils/logger');

// ─── Language names ────────────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
};

const DEVANAGARI_LANGUAGES = new Set(['hi', 'mr']);
const RTL_LANGUAGES        = new Set(['ur']);

// ─── System prompt builder ────────────────────────────────────────────────────

/**
 * buildExplainerSystemPrompt — creates the instruction for the clause explainer.
 *
 * @param {string} language — BCP 47 code, e.g. 'hi', 'ta', 'en'
 */
function buildExplainerSystemPrompt(language) {
  const langName = LANGUAGE_NAMES[language] || 'English';

  const scriptInstruction = DEVANAGARI_LANGUAGES.has(language)
    ? `You MUST respond entirely in ${langName} using Devanagari script. Do not use Roman letters.`
    : RTL_LANGUAGES.has(language)
    ? `You MUST respond entirely in ${langName} using correct Urdu script.`
    : language !== 'en'
    ? `You MUST respond entirely in ${langName}. Do not mix English unless it is a proper legal term with no ${langName} equivalent.`
    : 'Respond in clear, simple English.';

  return `You are a friendly Indian legal interpreter helping ordinary citizens understand their legal documents.

Your job: Explain a legal clause in plain, simple ${langName} that any person with a 10th-grade education can understand.

RULES:
1. Maximum 100 words in your explanation.
2. ${scriptInstruction}
3. Start with what the clause DOES in one sentence.
4. Use an everyday analogy if it helps (e.g. "Think of it like a receipt from a shop…").
5. End with what this means FOR THE PERSON reading the document.
6. Do NOT use legal jargon. If you must use a legal term, immediately explain it in brackets.
7. Keep the tone reassuring and supportive — the reader may be anxious or unfamiliar with courts.
8. Do NOT add disclaimers, caveats, or "consult a lawyer" statements — the user already has the document.`;
}

// ─── explainClause ────────────────────────────────────────────────────────────

/**
 * explainClause — generate a plain-language explanation of a legal clause.
 *
 * Used by:
 *   - POST /v1/documents/:id/explain-clause (SSE endpoint)
 *   - Pre-generation of clauseExplanations during document creation
 *
 * @param {string}  clauseText  — the legal text to explain (max ~500 chars recommended)
 * @param {string}  language    — user's preferred language code (default: 'en')
 * @param {boolean} stream      — if true, returns async generator of text deltas
 * @returns {Promise<string | AsyncGenerator<string>>}
 */
async function explainClause(clauseText, language = 'en', stream = true) {
  if (!clauseText || !clauseText.trim()) {
    throw new Error('clauseText is required');
  }

  const trimmedClause = clauseText.trim().slice(0, 800); // Cap to avoid token waste
  const systemPrompt  = buildExplainerSystemPrompt(language);
  const langName      = LANGUAGE_NAMES[language] || 'English';

  // Single-turn message — no history needed
  const messages = [
    {
      role:    'user',
      content: `Please explain this clause from my legal document in simple ${langName}:\n\n"${trimmedClause}"`,
    },
  ];

  logger.debug(`[clauseExplainer] Explaining clause (lang: ${language}, stream: ${stream}, length: ${trimmedClause.length})`);

  try {
    if (stream) {
      return await chat(messages, systemPrompt, true);
    }

    // Non-streaming: use generate() for a single clean call
    const prompt = `${systemPrompt}\n\nPlease explain this clause from my legal document in simple ${langName}:\n\n"${trimmedClause}"\n\nExplanation (max 100 words):`;
    const result = await generate(prompt, false);

    logger.debug(`[clauseExplainer] Explanation generated: ${result.length} chars`);
    return result;
  } catch (err) {
    logger.error(`[clauseExplainer] Failed to explain clause: ${err.message}`, {
      language,
      clausePreview: trimmedClause.slice(0, 100),
    });
    throw err;
  }
}

// ─── explainClauseBatch ───────────────────────────────────────────────────────

/**
 * explainClauseBatch — generate explanations for multiple clauses in one call.
 * Used during document generation to pre-populate clauseExplanations.
 *
 * @param {string[]} clauses  — array of clause texts
 * @param {string}   language — user's language code
 * @returns {Promise<string[]>} — array of explanations in same order
 */
async function explainClauseBatch(clauses, language = 'en') {
  if (!clauses || clauses.length === 0) return [];

  const langName = LANGUAGE_NAMES[language] || 'English';

  // Cap at 10 clauses to avoid huge prompts
  const capped = clauses.slice(0, 10);

  const clauseList = capped
    .map((text, i) => `CLAUSE ${i + 1}:\n"${text.trim().slice(0, 400)}"`)
    .join('\n\n');

  const prompt = `You are a plain-language legal interpreter for Indian citizens.

Explain each of the following ${capped.length} legal clauses in simple ${langName}.
Rules: Max 80 words per explanation. Use everyday language. Be supportive.
${DEVANAGARI_LANGUAGES.has(language) ? 'ALL explanations must be in Devanagari script.' : ''}
${RTL_LANGUAGES.has(language) ? 'ALL explanations must be in Urdu script.' : ''}
${language !== 'en' && !DEVANAGARI_LANGUAGES.has(language) && !RTL_LANGUAGES.has(language) ? `ALL explanations must be in ${langName}.` : ''}

${clauseList}

Respond with ONLY a JSON array of strings (no keys, no objects), one explanation per clause, in the same order:
["explanation for clause 1", "explanation for clause 2", ...]`;

  try {
    const result = await generate(prompt, false);

    // Try to parse the array from the response
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length === capped.length) {
          return parsed;
        }
      } catch {
        // Fall through to line-split fallback
      }
    }

    // Fallback: split by numbered pattern if JSON parse fails
    logger.warn('[clauseExplainer] Batch JSON parse failed, falling back to individual calls');
    const results = await Promise.all(
      capped.map((clause) => explainClause(clause, language, false))
    );
    return results;
  } catch (err) {
    logger.error(`[clauseExplainer] Batch explanation failed: ${err.message}`);
    // Return empty strings rather than throwing — document generation should not fail
    // just because clause explanations failed
    return capped.map(() => '');
  }
}

module.exports = { explainClause, explainClauseBatch, buildExplainerSystemPrompt };
