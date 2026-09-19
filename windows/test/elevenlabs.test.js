'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { transcribeMeeting, validateElevenLabsKey, scribeSegments, normalizeElevenLabsError, languageCode } = require('../src/main/elevenlabs');

const word = (text, start, end, speaker_id, type = 'word') => ({ text, start, end, speaker_id, type, logprob: -0.1 });

test('scribe words are grouped into speaker turns and non-words are ignored', () => {
  const { segments } = scribeSegments({ text: 'Hoi daar. Ja hallo.', words: [
    word('Hoi', 0.0, 0.3, 'speaker_0'), word(' ', 0.3, 0.4, 'speaker_0', 'spacing'), word('daar.', 0.4, 0.8, 'speaker_0'),
    word('(laughter)', 0.9, 1.4, 'speaker_0', 'audio_event'),
    word('Ja', 1.6, 1.8, 'speaker_1'), word('hallo.', 1.9, 2.3, 'speaker_1'),
    word('Oké', 4.5, 4.9, 'speaker_1')
  ] });
  assert.deepEqual(segments, [
    { text: 'Hoi daar.', startMs: 0, endMs: 800, speakerId: 'speaker_0' },
    { text: 'Ja hallo.', startMs: 1600, endMs: 2300, speakerId: 'speaker_1' },
    { text: 'Oké', startMs: 4500, endMs: 4900, speakerId: 'speaker_1' }
  ]);
  assert.throws(() => scribeSegments({ text: 'tekst zonder woorden', words: [] }), /woordtijdstempels/);
  assert.deepEqual(scribeSegments({ text: '', words: [] }).segments, []);
});

test('meeting request sends the wav, diarization, language and dictionary as Scribe expects', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ language_code: 'nld', audio_duration_secs: 2.5, text: 'Test', words: [word('Test', 0.1, 0.5, 'speaker_0')] }) }; };
  const wav = Buffer.from('RIFFfake');
  const result = await transcribeMeeting({ apiKey: 'sk_test', wav, settings: { language: 'nl-NL', dictionary: ['TakkieAI', { term: 'Aidem' }, 'x'.repeat(60)] }, fetchImpl });
  assert.equal(result.durationMs, 2500); assert.equal(result.languageCode, 'nld'); assert.equal(result.segments[0].text, 'Test');
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://api.elevenlabs.io/v1/speech-to-text');
  assert.equal(calls[0].init.headers['xi-api-key'], 'sk_test'); assert.ok(calls[0].init.signal instanceof AbortSignal);
  const form = calls[0].init.body;
  assert.equal(form.get('model_id'), 'scribe_v2'); assert.equal(form.get('diarize'), 'true'); assert.equal(form.get('timestamps_granularity'), 'word'); assert.equal(form.get('language_code'), 'nl');
  assert.deepEqual(form.getAll('keyterms'), ['TakkieAI', 'Aidem']);
  const file = form.get('file'); assert.equal(file.size, wav.length); assert.equal(file.type, 'audio/wav');
  assert.equal(languageCode('auto'), null); assert.equal(languageCode('en-US'), 'en');
});

test('api errors are tagged with the provider and mapped to user-safe categories', async () => {
  const fail = status => async () => ({ ok: false, status, json: async () => ({ detail: { message: 'nope' } }) });
  for (const [status, code] of [[401, 'auth'], [403, 'auth'], [429, 'rate_limit'], [402, 'rate_limit'], [500, 'network'], [422, 'model']]) {
    await assert.rejects(transcribeMeeting({ apiKey: 'k', wav: Buffer.alloc(4), settings: {}, fetchImpl: fail(status) }), error => { assert.equal(error.provider, 'elevenlabs'); assert.equal(error.status, status); assert.equal(normalizeElevenLabsError(error).code, code); return true; });
  }
  await assert.rejects(transcribeMeeting({ apiKey: 'k', wav: Buffer.alloc(4), settings: {}, fetchImpl: async () => { throw new TypeError('fetch failed'); } }), error => { assert.equal(error.provider, 'elevenlabs'); assert.equal(normalizeElevenLabsError(error).code, 'network'); return true; });
  await assert.rejects(transcribeMeeting({ apiKey: '', wav: Buffer.alloc(4), settings: {}, fetchImpl: async () => { throw new Error('must not be called'); } }), error => { assert.equal(normalizeElevenLabsError(error).code, 'auth'); assert.match(normalizeElevenLabsError(error).message, /Instellingen/); return true; });
});

test('key validation uses a tiny real request and reports success only on 200', async () => {
  let seen;
  assert.equal(await validateElevenLabsKey('sk_ok', async (_url, init) => { seen = init.body; return { ok: true, status: 200, json: async () => ({ text: '', words: [] }) }; }), true);
  assert.equal(seen.get('model_id'), 'scribe_v2'); assert.ok(seen.get('file').size > 44);
  await assert.rejects(validateElevenLabsKey('sk_bad', async () => ({ ok: false, status: 401, json: async () => ({}) })), error => error.status === 401);
});
