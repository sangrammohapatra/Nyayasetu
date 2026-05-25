const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const logger = require('../../utils/logger');

// ─── Client initialisation ─────────────────────────────────────────────────────

let _genAI = null;

function getGenAI() {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

const MODEL_NAME = 'gemini-2.5-flash';

// Safety settings — permissive enough for legal content (violence in FIRs, DV complaints, etc.)
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ─── Retry helper ──────────────────────────────────────────────────────────────

/**
 * withRetry — wraps an async fn with exponential backoff for rate-limit (429) and
 * transient errors. Gemini free tier is 15 RPM so retries are common in dev.
 *
 * @param {Function} fn          — async function to attempt
 * @param {number}   maxRetries  — default 3
 * @param {number}   baseDelayMs — initial delay in ms (doubles each retry)
 */
async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isRateLimit = err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.toLowerCase().includes('quota') ||
        err?.message?.toLowerCase().includes('rate limit');

      const isTransient = err?.status >= 500 || err?.message?.includes('503');

      if (!(isRateLimit || isTransient) || attempt === maxRetries) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      logger.warn(`[gemini] Attempt ${attempt}/${maxRetries} failed (${err?.status || err?.message?.slice(0, 60)}). Retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// ─── Message format conversion ─────────────────────────────────────────────────

/**
 * toGeminiHistory — converts the OpenAI-style messages array used throughout
 * NyayaSetu into Gemini's { role: 'user'|'model', parts: [{text}] } format.
 *
 * Rules:
 *   - 'assistant' role → 'model'
 *   - 'system' messages are excluded (system prompt is passed separately)
 *   - The LAST user message is returned separately as the new input (not in history)
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {{ history: Array, latestUserMessage: string }}
 */
function toGeminiHistory(messages) {
  // Filter out system messages — handled via systemInstruction
  const nonSystem = messages.filter((m) => m.role !== 'system');

  if (nonSystem.length === 0) {
    return { history: [], latestUserMessage: '' };
  }

  // The final message must be from the user (Gemini's sendMessage() adds it)
  // Split history from the current turn
  const lastMsg = nonSystem[nonSystem.length - 1];
  const historyMsgs = nonSystem.slice(0, -1);

  // Gemini requires alternating user/model turns in history
  // If there are consecutive same-role messages, merge them
  const history = [];
  for (const msg of historyMsgs) {
    const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
    const last = history[history.length - 1];

    if (last && last.role === geminiRole) {
      // Merge consecutive same-role messages
      last.parts[0].text += `\n${msg.content}`;
    } else {
      history.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }
  }

  // Ensure history doesn't end on a 'model' turn (Gemini requirement)
  // If it does, pop that message and prepend it to the latest user input
  let latestUserMessage = lastMsg.content;
  if (history.length > 0 && history[history.length - 1].role === 'model') {
    // Valid — history ends with model, new user message follows
  } else if (history.length > 0 && history[history.length - 1].role === 'user') {
    // History ends with user — Gemini won't accept this.
    // Pop and prefix into the current message.
    const extra = history.pop();
    latestUserMessage = `${extra.parts[0].text}\n${latestUserMessage}`;
  }

  return { history, latestUserMessage };
}

// ─── chat ──────────────────────────────────────────────────────────────────────

/**
 * chat — multi-turn conversation call.
 *
 * @param {Array<{role, content}>} messages     — full conversation history
 * @param {string}                 systemPrompt — instruction context
 * @param {boolean}                stream       — if true, returns async generator of text deltas
 * @returns {Promise<string | AsyncGenerator<string>>}
 */
async function chat(messages, systemPrompt, stream = false) {
  return withRetry(async () => {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemPrompt || undefined,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    const { history, latestUserMessage } = toGeminiHistory(messages);

    const chatSession = model.startChat({ history });

    if (!stream) {
      const result = await chatSession.sendMessage(latestUserMessage);
      const text = result.response.text();
      logger.debug(`[gemini] chat() → ${text.length} chars`);
      return text;
    }

    // Streaming — return async generator yielding text deltas
    const resultStream = await chatSession.sendMessageStream(latestUserMessage);

    async function* streamGenerator() {
      try {
        for await (const chunk of resultStream.stream) {
          const delta = chunk.text();
          if (delta) yield delta;
        }
      } catch (err) {
        logger.error('[gemini] Stream error:', err.message);
        throw err;
      }
    }

    return streamGenerator();
  });
}

// ─── generate ─────────────────────────────────────────────────────────────────

/**
 * generate — single-shot text generation (no history).
 * Used for document generation, clause explanation, and JSON extraction.
 *
 * @param {string}  prompt
 * @param {boolean} jsonMode — if true, instructs model to return only valid JSON
 * @returns {Promise<string | object>}
 */
async function generate(prompt, jsonMode = false) {
  return withRetry(async () => {
    const genAI = getGenAI();

    const finalPrompt = jsonMode
      ? `${prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences, no backticks, no explanation. Start your response with { and end with }.`
      : prompt;

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: jsonMode ? 0.2 : 0.7,  // Lower temp for structured output
        topK: 40,
        topP: 0.95,
        maxOutputTokens: jsonMode ? 8192 : 4096,
        ...(jsonMode && { responseMimeType: 'application/json' }),
      },
    });

    const result = await model.generateContent(finalPrompt);
    const text   = result.response.text().trim();

    if (!jsonMode) {
      logger.debug(`[gemini] generate() → ${text.length} chars`);
      return text;
    }

    // Parse JSON — strip any accidental markdown fences the model added
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/,      '')
      .replace(/```\s*$/,      '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      logger.debug('[gemini] generate(jsonMode) → parsed successfully');
      return parsed;
    } catch (parseErr) {
      logger.error('[gemini] JSON parse failed:', { cleaned: cleaned.slice(0, 200), error: parseErr.message });
      throw new Error(`Gemini returned invalid JSON: ${parseErr.message}`);
    }
  });
}

module.exports = { chat, generate };
