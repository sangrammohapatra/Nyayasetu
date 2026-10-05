/**
 * Unwrap a NyayaBot reply that was stored as raw model JSON.
 * Mirrors server/src/services/ai/aiNyayaBotService.js so a truncated
 * `{ "content": "..." }` payload still renders as markdown.
 */

const DEFAULT_DISCLAIMER =
  'NyayaBot provides general legal information, not legal advice. For your specific situation, please consult a qualified lawyer.';

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
    : DEFAULT_DISCLAIMER;

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
    disclaimer: disclaimer || DEFAULT_DISCLAIMER,
  };
}

export function parseNyayaBotContent(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return {
      content: typeof rawText === 'string' ? rawText : '',
      citations: [],
      suggestedTemplates: [],
      followUpQuestions: [],
      disclaimer: DEFAULT_DISCLAIMER,
    };
  }

  const text = rawText.trim();
  const direct = fromParsedObject(tryParseJson(text));
  if (direct) return direct;

  const repairedWhole = fromParsedObject(tryParseJson(repairJson(text)));
  if (repairedWhole) return repairedWhole;

  const start = text.indexOf('{');
  const slice = start === -1 ? text : text.slice(start);
  const salvaged = salvageFromText(slice);
  if (salvaged) return salvaged;

  return {
    content: unescapeLiteralEscapes(text),
    citations: [],
    suggestedTemplates: [],
    followUpQuestions: [],
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

export function normalizeNyayaBotMessage(message) {
  if (!message || message.role !== 'nyayabot' || !looksLikeEnvelope(message.content)) {
    return message;
  }

  const parsed = parseNyayaBotContent(message.content);
  return {
    ...message,
    content: parsed.content,
    citations: message.citations?.length ? message.citations : parsed.citations,
    suggestedTemplates: message.suggestedTemplates?.length ? message.suggestedTemplates : parsed.suggestedTemplates,
    followUpQuestions: message.followUpQuestions?.length ? message.followUpQuestions : parsed.followUpQuestions,
    disclaimer: message.disclaimer || parsed.disclaimer,
  };
}
