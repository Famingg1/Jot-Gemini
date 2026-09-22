'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startUpdates, checkUpdates, updateStatus } = require('../src/main/updates');
test('update checks do not overlap, fail safely, and never force a restart', async () => {
  const updater = new EventEmitter();
  let finish; let calls = 0;
  updater.checkForUpdates = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  updater.quitAndInstall = () => assert.fail('Updates must wait for a normal quit');
  const dispose = startUpdates({ updater });
  try {
    const first = checkUpdates(); await checkUpdates(); assert.equal(calls, 1);
    finish(); await first;
    updater.emit('update-downloaded'); assert.match(updateStatus(), /opnieuw op/);
    assert.equal(updater.autoInstallOnAppQuit, true);
    assert.equal(updater.allowDowngrade, false);
    updater.checkForUpdates = async () => { throw new Error('offline'); };
    await checkUpdates(); assert.match(updateStatus(), /niet gelukt/);
  } finally { dispose(); }
});
test('a downloaded update is exposed as ready and installs only on an explicit request', () => {
  const updater = new EventEmitter();
  let installs = 0;
  updater.checkForUpdates = async () => {};
  updater.quitAndInstall = (silent, runAfter) => { installs++; assert.equal(silent, true); assert.equal(runAfter, true); };
  const { updateState, installUpdate } = require('../src/main/updates');
  const dispose = startUpdates({ updater });
  try {
    assert.equal(installUpdate(), false, 'Nothing to install before a download');
    updater.emit('update-downloaded', { version: '9.9.9' });
    assert.equal(updateState().readyVersion, '9.9.9');
    assert.match(updateState().status, /9\.9\.9/);
    assert.equal(installs, 0);
    assert.equal(installUpdate(), true);
    assert.equal(installs, 1);
  } finally { dispose(); }
});
