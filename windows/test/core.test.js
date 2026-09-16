'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { wavHeader, pcmToWav } = require('../src/main/wav');
const { canTransition } = require('../src/main/state');
const {
  SessionManager, applyReplacements, countWords, snapshotClipboard, restoreClipboardIfUnchanged
} = require('../src/main/session-manager');
const { extractOutputText, normalizeError } = require('../src/main/gemini');
const { JotStorage } = require('../src/main/storage');

test('WAV output contains a valid PCM header and declared payload size', () => {
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128]);
  const header = wavHeader(pcm.length, 16000);
  const wav = pcmToWav(pcm, 16000);
  assert.equal(header.toString('ascii', 0, 4), 'RIFF');
  assert.equal(header.toString('ascii', 8, 12), 'WAVE');
  assert.equal(header.readUInt32LE(24), 16000);
  assert.equal(header.readUInt16LE(22), 1);
  assert.equal(header.readUInt16LE(34), 16);
  assert.equal(header.readUInt32LE(40), pcm.length);
  assert.deepEqual(wav.subarray(44), pcm);
});

test('dictation state machine allows valid flow and refuses ambiguous jumps', () => {
  assert.equal(canTransition('idle', 'listening'), true);
  assert.equal(canTransition('idle', 'secure'), true);
  assert.equal(canTransition('secure', 'idle'), true);
  assert.equal(canTransition('listening', 'locked'), true);
  assert.equal(canTransition('locked', 'processing'), true);
  assert.equal(canTransition('processing', 'inserting'), true);
  assert.equal(canTransition('inserting', 'success'), true);
  assert.equal(canTransition('idle', 'success'), false);
  assert.equal(canTransition('listening', 'success'), false);
});

test('replacement rules are case-insensitive and escape regular-expression text', () => {
  const result = applyReplacements('jot ai en C++ en JOT AI', [
    { from: 'jot ai', to: 'Jot AI' },
    { from: 'C++', to: 'C plus plus' }
  ]);
  assert.equal(result, 'Jot AI en C plus plus en Jot AI');
  assert.equal(countWords('Hallo\nwereld  opnieuw'), 3);
});

test('Gemini Interactions response extraction supports SDK and REST shapes', () => {
  assert.equal(extractOutputText({ output_text: '  direct antwoord  ' }), 'direct antwoord');
  assert.equal(extractOutputText({ steps: [
    { type: 'user_input', content: [{ type: 'text', text: 'ignored' }] },
    { type: 'model_output', content: [{ type: 'text', text: 'Hallo ' }, { type: 'text', text: 'wereld' }] }
  ] }), 'Hallo wereld');
});

test('Gemini errors map to actionable user-safe categories', () => {
  assert.equal(normalizeError({ status: 401, message: 'bad key' }).code, 'auth');
  assert.equal(normalizeError({ status: 429, message: 'quota' }).code, 'rate_limit');
  assert.equal(normalizeError(new Error('fetch failed')).code, 'network');
  assert.equal(normalizeError(new Error('bad audio')).code, 'model');
});

test('storage keeps settings, encrypts secrets, indexes history and rejects traversal deletes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jot-storage-'));
  const fakeSafeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`protected:${value}`),
    decryptString: (value) => value.toString().replace(/^protected:/u, '')
  };
  try {
    const storage = new JotStorage(root, fakeSafeStorage);
    storage.updateSettings({ hotkey: 'f8', unknown: 'ignored' });
    assert.equal(storage.settings.hotkey, 'f8');
    assert.equal(storage.settings.unknown, undefined);
    storage.saveApiKey('secret-value');
    assert.equal(storage.apiKey(), 'secret-value');
    assert.equal(fs.readFileSync(path.join(root, 'gemini-key.bin'), 'utf8').includes('secret-value'), true);

    const directory = storage.sessionDirectory('safe-id');
    storage.writeMeta(directory, {
      id: 'safe-id', startedAt: '2026-08-27T10:00:00.000Z', status: 'complete',
      targetApp: 'Notepad', durationSeconds: 20, finalTranscript: 'Drie mooie woorden'
    });
    assert.equal(storage.listHistory('mooie').length, 1);
    assert.deepEqual(storage.stats(), { words: 3, dictations: 1, averageWpm: 9 });
    assert.throws(() => storage.deleteRecord('../outside'), /Invalid recording id/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('interrupted PCM is recovered into retryable WAV history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jot-recovery-'));
  const fakeSafeStorage = { isEncryptionAvailable: () => true, encryptString: Buffer.from, decryptString: (value) => value.toString() };
  try {
    const storage = new JotStorage(root, fakeSafeStorage);
    const directory = storage.sessionDirectory('interrupted-id');
    storage.writeMeta(directory, {
      id: 'interrupted-id', startedAt: '2026-08-27T10:00:00.000Z', status: 'recording',
      targetApp: 'Notepad', targetWindow: 123, sampleRate: 16000, durationSeconds: 0,
      rawTranscript: '', finalTranscript: '', errorCode: '', errorMessage: ''
    });
    fs.writeFileSync(path.join(directory, 'audio.pcm'), Buffer.alloc(16000, 1));
    const nativeHelper = new EventEmitter();
    const manager = new SessionManager({ storage, nativeHelper, clipboard: { writeText() {} } });
    assert.equal(manager.recoverInterrupted(), 1);
    const recovered = storage.listHistory()[0];
    assert.equal(recovered.status, 'queuedForRetry');
    assert.equal(recovered.audioAvailable, true);
    assert.equal(fs.readFileSync(path.join(directory, 'audio.wav')).toString('ascii', 0, 4), 'RIFF');
    assert.equal(fs.existsSync(path.join(directory, 'audio.pcm')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic paste targets the original window and preserves the clipboard', async () => {
  const nativeHelper = new EventEmitter();
  nativeHelper.paste = (expectedWindow) => {
    nativeHelper.expectedWindow = expectedWindow;
    setImmediate(() => nativeHelper.emit('event', { type: 'insert', app: 'ok', hwnd: expectedWindow }));
  };
  const clipboard = createFakeClipboard('Bestaande inhoud');
  const manager = new SessionManager({ storage: {}, nativeHelper, clipboard });
  const outcome = await manager.insert('Nieuw transcript', 4242);
  assert.equal(outcome, 'ok');
  assert.equal(nativeHelper.expectedWindow, 4242);
  assert.equal(clipboard.readText(), 'Nieuw transcript');

  const snapshot = snapshotClipboard(clipboard);
  clipboard.writeText('Tijdelijke tekst');
  assert.equal(restoreClipboardIfUnchanged(clipboard, 'Tijdelijke tekst', snapshot), true);
  assert.equal(clipboard.readText(), 'Nieuw transcript');
  clipboard.writeText('Door gebruiker gekopieerd');
  assert.equal(restoreClipboardIfUnchanged(clipboard, 'Tijdelijke tekst', snapshot), false);
  assert.equal(clipboard.readText(), 'Door gebruiker gekopieerd');
});

function createFakeClipboard(initialText) {
  let data = { text: initialText, html: '', rtf: '' };
  return {
    readText: () => data.text || '',
    readHTML: () => data.html || '',
    readRTF: () => data.rtf || '',
    readImage: () => ({ isEmpty: () => true }),
    writeText: (text) => { data = { text, html: '', rtf: '' }; },
    write: (value) => { data = { ...value }; },
    clear: () => { data = { text: '', html: '', rtf: '' }; }
  };
}
