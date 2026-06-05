const logger = require('../../utils/logger');

// ─── Provider registry ─────────────────────────────────────────────────────────
//
// Providers are lazy-loaded so the server starts cleanly even if one set of
// credentials is missing (e.g. ANTHROPIC_API_KEY not set in dev).
//
// To add a new provider: add an entry to PROVIDERS, set AI_PROVIDER in .env.

const PROVIDERS = {
  gemini: () => require('./geminiClient'),
  claude: () => require('./claudeClient'),
};

let _provider = null;
let _providerName = null;

/**
 * getProvider — resolve and cache the active AI provider.
 * Reads AI_PROVIDER from env on first call only — restart required to switch.
 */
function getProvider() {
  if (_provider) return _provider;

  const name = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();

  const factory = PROVIDERS[name];
  if (!factory) {
    throw new Error(
      `Unknown AI_PROVIDER="${name}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  _provider = factory();
  _providerName = name;

  logger.info(`[aiProvider] Active provider: ${_providerName}`);
  return _provider;
}

// ─── Public interface ──────────────────────────────────────────────────────────
//
// These two functions are the ONLY entry points used throughout the codebase.
// Callers never import geminiClient or claudeClient directly.

/**
 * chat — multi-turn conversation with the active AI provider.
 *
 * @param {Array<{role: 'user'|'assistant'|'system', content: string}>} messages
 *   Full conversation history. The last message is the current user turn.
 * @param {string}  systemPrompt — instruction context for the AI
 * @param {boolean} stream       — if true, returns async generator of text deltas
 * @returns {Promise<string | AsyncGenerator<string>>}
 */
async function chat(messages, systemPrompt, stream = false, jsonMode = false) {
  try {
    return await getProvider().chat(messages, systemPrompt, stream, jsonMode);
  } catch (err) {
    logger.error(`[aiProvider] chat() failed (provider=${_providerName}): ${err.message}`);
    throw err;
  }
}

/**
 * generate — single-shot text or JSON generation (no conversation history).
 *
 * @param {string}  prompt
 * @param {boolean} jsonMode — if true, parses and returns a JSON object
 * @returns {Promise<string | object>}
 */
async function generate(prompt, jsonMode = false) {
  try {
    return await getProvider().generate(prompt, jsonMode);
  } catch (err) {
    logger.error(`[aiProvider] generate() failed (provider=${_providerName}): ${err.message}`);
    throw err;
  }
}

/**
 * getProviderName — returns the active provider name for logging/diagnostics.
 */
function getProviderName() {
  getProvider(); // Ensure initialised
  return _providerName;
}

module.exports = { chat, generate, getProviderName };
