const { transcribe: providerTranscribe } = require('./whisperProvider');

/**
 * Transcribe an audio buffer to text.
 * Used by chat.controller.js voiceMessage handler.
 *
 * @param {Buffer} audioBuffer  Raw audio bytes from multer memoryStorage
 * @param {string} mimeType     e.g. 'audio/webm'
 * @param {string} language     App language code (en, hi, bn, …)
 * @returns {Promise<string>}   Trimmed transcript
 */
async function transcribe(audioBuffer, mimeType, language) {
  const text = await providerTranscribe(audioBuffer, mimeType, language);
  return text.trim();
}

// Legacy compat — chatController.js (older file) calls voiceService.transcribeAudio(buffer)
async function transcribeAudio(audioBuffer) {
  return transcribe(audioBuffer, 'audio/webm', 'hi');
}

module.exports = { transcribe, transcribeAudio };
