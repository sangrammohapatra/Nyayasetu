const Anthropic = require('@anthropic-ai/sdk');
const logger    = require('../../utils/logger');

// ─── Client initialisation ─────────────────────────────────────────────────────

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const MODEL    = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;

// ─── Retry helper ──────────────────────────────────────────────────────────────

/**
 * withRetry — exponential backoff for overload (529) and rate-limit (429) errors.
 *
 * @param {Function} fn
 * @param {number}   maxRetries
 * @param {number}   baseDelayMs
 */
async function withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Anthropic error shapes: err.status (HTTP code) or err instanceof Anthropic.APIError
      const status = err?.status ?? err?.statusCode;

      const isRetryable =
        status === 429 ||   // Rate limited
        status === 529 ||   // Overloaded
        status >= 500 ||    // Server error
        err?.message?.toLowerCase().includes('overloaded') ||
        err?.message?.toLowerCase().includes('rate limit');

      if (!isRetryable || attempt === maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      logger.warn(`[claude] Attempt ${attempt}/${maxRetries} failed (status=${status}). Retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

// ─── Message format conversion ─────────────────────────────────────────────────

/**
 * toAnthropicMessages — converts the shared messages format to Anthropic's shape.
 *
 * Claude rules:
 *   - System messages are NOT in the messages array — passed as top-level `system`
 *   - Messages must strictly alternate user/assistant
 *   - Must start with a user message
 *   - 'assistant' role maps directly
 *
 * @param {Array<{role, content}>} messages
 * @returns {Array<{role: 'user'|'assistant', content: string}>}
 */
function toAnthropicMessages(messages) {
  const filtered = messages.filter((m) => m.role !== 'system');
  if (filtered.length === 0) return [];

  const result = [];

  for (const msg of filtered) {
    const role    = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = String(msg.content || '').trim();

    if (!content) continue;

    const last = result[result.length - 1];

    // Merge consecutive same-role messages (Claude requires strict alternation)
    if (last && last.role === role) {
      last.content += `\n${content}`;
    } else {
      result.push({ role, content });
    }
  }

  // Anthropic requires the first message to be from the user
  if (result.length > 0 && result[0].role === 'assistant') {
    result.unshift({ role: 'user', content: '(context)' });
  }

  return result;
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
    const client   = getClient();
    const msgArray = toAnthropicMessages(messages);

    if (msgArray.length === 0) {
      throw new Error('No valid messages to send to Claude');
    }

    const params = {
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      messages:   msgArray,
      ...(systemPrompt && { system: systemPrompt }),
    };

    if (!stream) {
      const response = await client.messages.create(params);
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      logger.debug(`[claude] chat() → ${text.length} chars, stop_reason: ${response.stop_reason}`);
      return text;
    }

    // Streaming — return async generator yielding text deltas
    const streamResponse = await client.messages.create({ ...params, stream: true });

    async function* streamGenerator() {
      try {
        for await (const event of streamResponse) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            const delta = event.delta.text;
            if (delta) yield delta;
          }
        }
      } catch (err) {
        logger.error('[claude] Stream error:', err.message);
        throw err;
      }
    }

    return streamGenerator();
  });
}

// ─── generate ─────────────────────────────────────────────────────────────────

/**
 * generate — single-shot generation (no history).
 *
 * @param {string}  prompt
 * @param {boolean} jsonMode — instructs Claude to return only valid JSON
 * @returns {Promise<string | object>}
 */
async function generate(prompt, jsonMode = false) {
  return withRetry(async () => {
    const client = getClient();

    const systemPrompt = jsonMode
      ? 'You are a precise JSON generator. Respond with ONLY a valid JSON object. No markdown, no code fences, no backticks, no preamble, no explanation. Your entire response must be parseable by JSON.parse(). Start with { and end with }.'
      : undefined;

    const finalPrompt = jsonMode
      ? `${prompt}\n\nRemember: respond with ONLY the JSON object, nothing else.`
      : prompt;

    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: jsonMode ? MAX_TOKENS : 2048,
      messages:   [{ role: 'user', content: finalPrompt }],
      ...(systemPrompt && { system: systemPrompt }),
      ...(jsonMode && {
        temperature: 0,  // Deterministic for structured output
      }),
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!jsonMode) {
      logger.debug(`[claude] generate() → ${text.length} chars`);
      return text;
    }

    // Strip any accidental markdown wrappers
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/,      '')
      .replace(/```\s*$/,      '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      logger.debug('[claude] generate(jsonMode) → parsed successfully');
      return parsed;
    } catch (parseErr) {
      logger.error('[claude] JSON parse failed:', { preview: cleaned.slice(0, 200), error: parseErr.message });
      throw new Error(`Claude returned invalid JSON: ${parseErr.message}`);
    }
  });
}

module.exports = { chat, generate };
