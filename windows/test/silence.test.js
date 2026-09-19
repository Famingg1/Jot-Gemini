'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { compressSilence } = require('../src/main/silence');

const RATE = 16000;
// Deterministic pseudo-noise so frames have a realistic RMS instead of a flat tone.
function tone(ms, amplitude, seed = 1) {
  const samples = Math.round(RATE * ms / 1000), out = Buffer.alloc(samples * 2);
  let x = seed;
  for (let n = 0; n < samples; n++) { x = (x * 1103515245 + 12345) & 0x7fffffff; out.writeInt16LE(Math.round((x / 0x7fffffff * 2 - 1) * amplitude), n * 2); }
  return out;
}
const speech = ms => tone(ms, 6000, 7), silence = ms => tone(ms, 40, 3);
const durationMs = pcm => pcm.length / 2 / RATE * 1000;

test('a long thinking pause is shortened to half a second while speech stays intact', () => {
  const before = speech(2000), after = speech(1500);
  const input = Buffer.concat([before, silence(10000), after]);
  const result = compressSilence(input, RATE);
  assert.equal(result.removedMs, 9500);
  assert.equal(durationMs(result.pcm), 4000);
  assert.ok(result.pcm.subarray(0, before.length).equals(before), 'speech before the pause is untouched');
  assert.ok(result.pcm.subarray(result.pcm.length - after.length).equals(after), 'speech after the pause is untouched');
});

test('natural pauses shorter than the gap threshold are left alone', () => {
  const input = Buffer.concat([speech(1000), silence(800), speech(1000), silence(1100), speech(500)]);
  const result = compressSilence(input, RATE);
  assert.equal(result.removedMs, 0);
  assert.equal(result.pcm, input);
});

test('leading and trailing silence are trimmed to the kept margin', () => {
  const input = Buffer.concat([silence(3000), speech(1000), silence(4000)]);
  const result = compressSilence(input, RATE);
  assert.equal(durationMs(result.pcm), 2000);
});

test('audio without any speech and very short clips are returned unchanged', () => {
  const quiet = silence(5000);
  assert.equal(compressSilence(quiet, RATE).pcm, quiet);
  const short = speech(300);
  assert.equal(compressSilence(short, RATE).pcm, short);
});

test('dictation upload uses a shortened copy and keeps the original recording', t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { EventEmitter } = require('node:events');
  const { SessionManager } = require('../src/main/session-manager'); const { JotStorage } = require('../src/main/storage'); const { pcmToWav } = require('../src/main/wav');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takkie-upload-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storage = new JotStorage(root, { isEncryptionAvailable: () => false }); const sessions = new SessionManager({ storage, nativeHelper: new EventEmitter(), clipboard: {} });
  const directory = storage.sessionDirectory('paused'); const original = pcmToWav(Buffer.concat([speech(2000), silence(10000), speech(1500)]), RATE);
  fs.writeFileSync(path.join(directory, 'audio.wav'), original);
  const meta = { id: 'paused', durationSeconds: 13.5, sampleRate: RATE, status: 'recorded' }; storage.writeMeta(directory, meta);
  const upload = sessions.prepareUpload({ directory, meta });
  assert.equal(upload.temporary, true); assert.equal(path.basename(upload.path), 'upload.wav'); assert.equal(Math.round(upload.ms), 4000); assert.equal(meta.uploadedSeconds, 4);
  assert.ok(fs.readFileSync(path.join(directory, 'audio.wav')).equals(original), 'original audio is untouched');
  const plain = storage.sessionDirectory('plain'); fs.writeFileSync(path.join(plain, 'audio.wav'), pcmToWav(speech(3000), RATE));
  const direct = sessions.prepareUpload({ directory: plain, meta: { id: 'plain', durationSeconds: 3, sampleRate: RATE } });
  assert.equal(direct.temporary, false); assert.equal(path.basename(direct.path), 'audio.wav'); assert.equal(direct.ms, 3000);
});
