'use strict';

// ElevenLabs Scribe v2 for meeting transcription. One request per meeting: files up to
// 10 hours, diarization for up to 32 speakers, word timestamps. The key is the user's own.
const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODEL = 'scribe_v2';

function tagged(error, status) {
  return Object.assign(error instanceof Error ? error : new Error(String(error)), { provider: 'elevenlabs', status: Number(status || error?.status || 0) });
}

function normalizeElevenLabsError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || error || '');
  if (/missing elevenlabs api key/i.test(message)) return { code: 'auth', message: 'Voeg je ElevenLabs API-key toe via Instellingen → Meetings. Je opname is bewaard.' };
  if (status === 401 || status === 403) return { code: 'auth', message: 'Je ElevenLabs API-key is ongeldig of mist de speech-to-text rechten. Je opname is bewaard.' };
  if (status === 402 || /quota|credits|insufficient/i.test(message)) return { code: 'rate_limit', message: 'Je ElevenLabs-tegoed is op of de limiet is bereikt. De opname is bewaard; probeer later opnieuw.' };
  if (status === 429) return { code: 'rate_limit', message: 'ElevenLabs heeft de limiet bereikt. De opname is bewaard; probeer straks opnieuw.' };
  if (status >= 500 || status === 0 || /fetch failed|network|timeout|aborted|ENOTFOUND|ECONN/i.test(message)) return { code: 'network', message: 'Geen verbinding met ElevenLabs. De opname is lokaal bewaard.' };
  return { code: 'model', message: 'ElevenLabs kon deze opname niet verwerken. De opname is lokaal bewaard.' };
}

// Groups Scribe words into speaker turns, same rules as the Gemini specialist path.
function scribeSegments(response) {
  const words = Array.isArray(response?.words) ? response.words.filter(word => word && word.type === 'word' && typeof word.text === 'string') : [];
  if (!words.length && typeof response?.text === 'string' && response.text.trim()) throw new Error('Transcript ontbreekt woordtijdstempels; audio is bewaard.');
  const ms = value => { if (!Number.isFinite(value) || value < 0) throw new Error('Ongeldige transcriptietimestamp.'); return Math.round(value * 1000); };
  const segments = [];
  for (const word of words) {
    const startMs = ms(word.start), endMs = ms(word.end), speakerId = String(word.speaker_id || 'unknown');
    const last = segments.at(-1);
    if (last && last.speakerId === speakerId && startMs - last.endMs < 1500 && endMs - last.startMs < 15000) { last.text += ` ${word.text}`; last.endMs = Math.max(last.endMs, endMs); }
    else segments.push({ text: word.text, startMs, endMs, speakerId });
  }
  return { segments };
}

function languageCode(language) {
  if (!language || language === 'auto') return null;
  const match = /^([a-z]{2,3})/i.exec(String(language));
  return match ? match[1].toLowerCase() : null;
}

function buildForm({ wav, settings = {}, filename = 'meeting.wav' }) {
  const form = new FormData();
  form.append('model_id', MODEL);
  form.append('file', new Blob([wav], { type: 'audio/wav' }), filename);
  form.append('diarize', 'true');
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  const language = languageCode(settings.language);
  if (language) form.append('language_code', language);
  const terms = (settings.dictionary || []).map(item => typeof item === 'string' ? item : item?.term).filter(term => typeof term === 'string' && term.trim() && term.length < 50).slice(0, 1000);
  for (const term of terms) form.append('keyterms', term.trim());
  return form;
}

async function request({ apiKey, form, signal, fetchImpl = fetch, timeoutMs = 600000 }) {
  if (!apiKey) throw tagged(new Error('Missing ElevenLabs API key.'), 401);
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);
  let response;
  try { response = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form, signal: AbortSignal.any(signals) }); }
  catch (error) { throw tagged(error, 0); }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.detail?.message || ''; } catch { /* body is not JSON */ }
    throw tagged(new Error(detail || `ElevenLabs returned HTTP ${response.status}.`), response.status);
  }
  try { return await response.json(); } catch (error) { throw tagged(new Error('ElevenLabs gaf geen geldig antwoord.'), 0); }
}

async function transcribeMeeting({ apiKey, wav, settings, signal, fetchImpl }) {
  const json = await request({ apiKey, form: buildForm({ wav, settings }), signal, fetchImpl });
  const { segments } = scribeSegments(json);
  return { segments, durationMs: Number.isFinite(json.audio_duration_secs) ? Math.round(json.audio_duration_secs * 1000) : null, languageCode: json.language_code || null };
}

// Validation costs a fraction of a cent: scoped keys cannot read the account, so a 200 ms
// silent clip through the real endpoint is the only reliable check.
async function validateElevenLabsKey(apiKey, fetchImpl) {
  const { pcmToWav } = require('./wav');
  const wav = pcmToWav(Buffer.alloc(16000 * 2 * 0.2), 16000);
  await request({ apiKey, form: buildForm({ wav, settings: {}, filename: 'check.wav' }), fetchImpl, timeoutMs: 30000 });
  return true;
}

module.exports = { transcribeMeeting, validateElevenLabsKey, scribeSegments, normalizeElevenLabsError, buildForm, languageCode, MODEL };
