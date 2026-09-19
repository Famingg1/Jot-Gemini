'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { EventEmitter } = require('node:events');
const { SessionManager } = require('../src/main/session-manager');
const { JotStorage } = require('../src/main/storage');
const { NativeHelper } = require('../src/main/native-helper');

function setup(t, undoWindowMs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takkie-undo-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storage = new JotStorage(root, { isEncryptionAvailable: () => false });
  const sessions = new SessionManager({ storage, nativeHelper: new EventEmitter(), clipboard: {}, undoWindowMs });
  const processed = [], states = [];
  sessions.on('state', value => states.push(value));
  sessions.process = async session => { processed.push(session); };
  sessions.on('recording', command => { if (command.action === 'stop') setTimeout(() => sessions.captureStopped(command.id), 10); });
  return { storage, sessions, processed, states };
}
function record(sessions, bytes = 16000) {
  sessions.begin({ app: 'Notepad' });
  const { id, directory } = sessions.current;
  sessions.captureReady(id);
  sessions.appendChunk(Buffer.alloc(bytes, 1));
  return { id, directory };
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('escape keeps the audio and undo within the window transcribes it anyway', async t => {
  const { sessions, processed, states } = setup(t, 500);
  const { id, directory } = record(sessions);
  await sessions.cancel();
  assert.equal(sessions.state, 'cancelled');
  assert.equal(states.at(-1).undoable, true);
  assert.ok(fs.existsSync(path.join(directory, 'audio.wav')));
  assert.equal(await sessions.undoCancel(), true);
  assert.equal(processed.length, 1);
  assert.equal(processed[0].meta.id, id);
  assert.equal(processed[0].meta.status, 'recorded');
  assert.equal(sessions.state, 'processing');
  assert.equal(await sessions.undoCancel(), false);
  assert.equal(sessions.begin({}), false, 'no new recording while transcribing');
  assert.equal(sessions.state, 'processing');
});

test('without undo a short cancelled recording is deleted after the window closes', async t => {
  const { storage, sessions, processed } = setup(t, 60);
  const { id } = record(sessions);
  await sessions.cancel();
  assert.ok(storage.listHistory().some(item => item.id === id));
  await wait(140);
  assert.equal(storage.listHistory().some(item => item.id === id), false);
  assert.equal(sessions.state, 'idle');
  assert.equal(await sessions.undoCancel(), false);
  assert.equal(processed.length, 0);
});

test('starting a new dictation during the undo window finalizes the previous cancel', async t => {
  const { storage, sessions } = setup(t, 5000);
  const { id } = record(sessions);
  await sessions.cancel();
  assert.equal(sessions.begin({}), true);
  assert.equal(storage.listHistory().some(item => item.id === id), false);
  assert.equal(sessions.state, 'starting');
  assert.equal(await sessions.undoCancel(), false);
});

test('a cancel without usable audio offers no undo and cleans up immediately', async t => {
  const { storage, sessions, states } = setup(t, 5000);
  const { id } = record(sessions, 100);
  await sessions.cancel();
  assert.equal(sessions.state, 'cancelled');
  assert.notEqual(states.at(-1).undoable, true);
  assert.equal(storage.listHistory().some(item => item.id === id), false);
  assert.equal(await sessions.undoCancel(), false);
});

test('native helper is told when dictation is active so it can swallow Escape', () => {
  const helper = new NativeHelper({ appPath: '', resourcesPath: '', packaged: false });
  const writes = [];
  helper.process = { stdin: { writable: true, destroyed: false, write: chunk => writes.push(chunk) } };
  helper.setDictating(true);
  helper.setDictating(false);
  assert.deepEqual(writes, ['ACTIVE 1\n', 'ACTIVE 0\n']);
});
