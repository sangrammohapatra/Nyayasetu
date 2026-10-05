/**
 * ollamaClient.js
 * Local Ollama provider. Same chat() / generate() contract as geminiClient
 * and claudeClient so the rest of the app does not care which model is running.
 *
 *   OLLAMA_BASE_URL   default http://127.0.0.1:11434
 *   OLLAMA_MODEL      default llama3.2:1b  (`ollama list` to see what is pulled)
 *   OLLAMA_NUM_CTX    default 8192
 *   OLLAMA_TIMEOUT_MS default 180000
 */

const logger = require('../../utils/logger');

function baseUrl() {
  return (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
}

function modelName() {
  return process.env.OLLAMA_MODEL || 'llama3.2:1b';
}

function numPredict(jsonMode) {
  if (process.env.OLLAMA_NUM_PREDICT) return Number(process.env.OLLAMA_NUM_PREDICT);
  return jsonMode ? 2048 : 1024;
}

function timeoutMs() {
  return Number(process.env.OLLAMA_TIMEOUT_MS || 180000);
}

function toOllamaMessages(messages, systemPrompt, jsonMode) {
  const out = [];
  let system = (systemPrompt || '').trim();
  if (jsonMode) {
    system += `${system ? '\n\n' : ''}Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation. Start with { and end with }.`;
  }
  if (system) out.push({ role: 'system', content: system });

  for (const msg of messages || []) {
    if (!msg || msg.role === 'system') {
      if (msg?.content && out[0]?.role === 'system') out[0].content += `\n${msg.content}`;
      continue;
    }
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = String(msg.content || '').trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n${content}`;
    else out.push({ role, content });
  }

  if (!out.some((m) => m.role === 'user')) {
    out.push({ role: 'user', content: 'Continue.' });
  }
  return out;
}

function normalizeError(err) {
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
    return new Error('Ollama took too long to respond. Try again, or raise OLLAMA_TIMEOUT_MS.');
  }
  const code = err?.cause?.code || err?.cause?.errors?.[0]?.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || /fetch failed/i.test(err?.message || '')) {
    return new Error(`Cannot reach Ollama at ${baseUrl()}. Start it with "ollama serve".`);
  }
  return err;
}

async function ollamaChat(messages, { stream, jsonMode }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  const clear = () => clearTimeout(timer);

  let res;
  try {
    res = await fetch(`${baseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName(),
        messages,
        stream,
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || '30m',
        ...(jsonMode && { format: 'json' }),
        options: {
          temperature: jsonMode ? 0.2 : 0.7,
          num_ctx: Number(process.env.OLLAMA_NUM_CTX || 8192),
          num_predict: numPredict(jsonMode),
        },
      }),
    });
  } catch (err) {
    clear();
    throw normalizeError(err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    clear();
    throw new Error(`Ollama request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return { res, clear };
}

async function readChatText(res, clear) {
  try {
    const data = await res.json();
    if (data?.error) throw new Error(`Ollama error: ${data.error}`);
    const text = data?.message?.content || '';
    if (!String(text).trim()) throw new Error('Ollama returned an empty response.');
    return text;
  } finally {
    clear();
  }
}

async function* streamDeltas(res, clear) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line);
        if (chunk.error) throw new Error(`Ollama error: ${chunk.error}`);
        const delta = chunk.message?.content;
        if (delta) yield delta;
      }
    }
  } catch (err) {
    throw normalizeError(err);
  } finally {
    clear();
    reader.releaseLock?.();
  }
}

function parseJsonText(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(cleaned);
}

/**
 * chat — multi-turn conversation.
 * jsonMode returns the raw JSON string (callers parse it themselves).
 * stream returns an async generator of text deltas.
 */
async function chat(messages, systemPrompt, stream = false, jsonMode = false) {
  const ollamaMessages = toOllamaMessages(messages, systemPrompt, jsonMode);
  const { res, clear } = await ollamaChat(ollamaMessages, { stream, jsonMode });

  if (stream) return streamDeltas(res, clear);

  const text = await readChatText(res, clear);
  logger.debug(`[ollama] chat() → ${text.length} chars, model=${modelName()}`);
  return text;
}

/**
 * generate — single-shot text or JSON.
 * jsonMode parses and returns an object, matching geminiClient / claudeClient.
 */
async function generate(prompt, jsonMode = false) {
  const finalPrompt = jsonMode
    ? `${prompt}\n\nRemember: respond with ONLY the JSON object, nothing else.`
    : prompt;
  const { res, clear } = await ollamaChat(
    toOllamaMessages([{ role: 'user', content: finalPrompt }], '', jsonMode),
    { stream: false, jsonMode },
  );
  const text = (await readChatText(res, clear)).trim();

  if (!jsonMode) {
    logger.debug(`[ollama] generate() → ${text.length} chars, model=${modelName()}`);
    return text;
  }

  try {
    const parsed = parseJsonText(text);
    logger.debug(`[ollama] generate(jsonMode) → parsed successfully, model=${modelName()}`);
    return parsed;
  } catch (parseErr) {
    logger.error('[ollama] JSON parse failed:', { preview: text.slice(0, 200), error: parseErr.message });
    throw new Error(`Ollama returned invalid JSON: ${parseErr.message}`);
  }
}

module.exports = { chat, generate };
