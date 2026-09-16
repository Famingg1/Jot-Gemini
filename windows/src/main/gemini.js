'use strict';

const fs = require('node:fs');

function extractOutputText(interaction) {
  if (typeof interaction?.output_text === 'string') return interaction.output_text.trim();
  const modelSteps = (interaction?.steps || []).filter((step) => step.type === 'model_output');
  const content = modelSteps.at(-1)?.content || [];
  return content.filter((part) => part.type === 'text').map((part) => part.text || '').join('').trim();
}

function normalizeError(error) {
  const message = String(error?.message || error || 'Unknown Gemini error');
  const status = Number(error?.status || error?.code || 0);
  if (status === 401 || status === 403 || /api.?key|permission|unauth/i.test(message)) return { code: 'auth', message: 'Je Gemini API-key is ongeldig of heeft geen toegang tot dit model.' };
  if (status === 429 || /quota|rate.?limit|resource exhausted/i.test(message)) return { code: 'rate_limit', message: 'Gemini heeft de limiet bereikt. De opname is bewaard; probeer straks opnieuw.' };
  if (status >= 500 || /fetch failed|network|timeout|ENOTFOUND|ECONN/i.test(message)) return { code: 'network', message: 'Geen verbinding met Gemini. De opname is lokaal bewaard.' };
  return { code: 'model', message: 'Gemini kon deze opname niet verwerken. De opname is lokaal bewaard.' };
}

async function transcribe({ apiKey, audioPath, settings }) {
  if (!apiKey) throw Object.assign(new Error('Missing Gemini API key.'), { status: 401 });
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 180000 } });
  const size = fs.statSync(audioPath).size;
  let audioInput;
  let uploaded;

  if (size <= 12 * 1024 * 1024) {
    audioInput = {
      type: 'audio',
      data: fs.readFileSync(audioPath).toString('base64'),
      mime_type: 'audio/wav'
    };
  } else {
    uploaded = await client.files.upload({ file: audioPath, config: { mimeType: 'audio/wav' } });
    audioInput = { type: 'audio', uri: uploaded.uri, mime_type: uploaded.mimeType || 'audio/wav' };
  }

  const transcriptionConfig = {
    custom_vocabulary: (settings.dictionary || []).map((item) => typeof item === 'string' ? item : item.term).filter(Boolean).slice(0, 100),
    language_codes: settings.language && settings.language !== 'auto' ? [settings.language] : [],
    mode: { type: settings.smartTranscription ? 'smart' : 'verbatim' }
  };

  try {
    const response = await client.interactions.create({
      model: settings.model || 'gemini-3.5-transcribe',
      input: [audioInput],
      generation_config: { transcription_config: transcriptionConfig },
      store: false
    });
    const text = extractOutputText(response);
    if (!text) throw new Error('Gemini returned an empty transcript.');
    return text;
  } finally {
    if (uploaded?.name) client.files.delete({ name: uploaded.name }).catch(() => {});
  }
}

async function validateKey(apiKey) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Object.assign(new Error(`Gemini returned HTTP ${response.status}.`), { status: response.status });
  return true;
}

module.exports = { transcribe, validateKey, extractOutputText, normalizeError };
