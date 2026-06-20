const axios = require('axios');

const HF_API_KEY      = process.env.HF_API_KEY;
const HF_WHISPER_MODEL = process.env.HF_WHISPER_MODEL || 'openai/whisper-large-v3';
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;

// Whisper ISO-639-1 codes for Indian languages
const LANG_MAP = {
  en: 'en', hi: 'hi', bn: 'bn', mr: 'mr',
  ta: 'ta', te: 'te', gu: 'gu', kn: 'kn',
  ml: 'ml', pa: 'pa', ur: 'ur',
};

async function transcribeWithHuggingFace(audioBuffer, mimeType, language) {
  const url = `https://api-inference.huggingface.co/models/${HF_WHISPER_MODEL}`;
  const params = LANG_MAP[language] ? { parameters: { language: LANG_MAP[language] } } : {};

  // HF Inference API accepts raw audio bytes; language hint goes in query params
  const response = await axios.post(url, audioBuffer, {
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': mimeType || 'audio/webm',
    },
    params: LANG_MAP[language] ? { language: LANG_MAP[language] } : undefined,
    timeout: 45_000,
    responseType: 'json',
  });

  return response.data?.text || '';
}

async function transcribeWithOpenAI(audioBuffer, mimeType, language) {
  // Lazy-require so the server doesn't break if openai package isn't installed in dev
  const { OpenAI } = require('openai');
  const { Readable } = require('stream');

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const ext = (mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
  const readable = Readable.from(audioBuffer);
  readable.path = `audio.${ext}`;

  const transcript = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: readable,
    language: LANG_MAP[language] || undefined,
  });

  return transcript.text || '';
}

/**
 * Transcribe audio using whichever provider is configured.
 * Priority: OpenAI (if OPENAI_API_KEY set) → HuggingFace (if HF_API_KEY set).
 */
async function transcribe(audioBuffer, mimeType, language) {
  if (OPENAI_API_KEY) {
    return transcribeWithOpenAI(audioBuffer, mimeType, language);
  }
  if (HF_API_KEY) {
    return transcribeWithHuggingFace(audioBuffer, mimeType, language);
  }
  throw new Error(
    'No voice transcription provider configured. Set HF_API_KEY (dev) or OPENAI_API_KEY (prod) in .env.'
  );
}

module.exports = { transcribe };
