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
    updater.emit('update-downloaded'); assert.match(updateStatus(), /afsluiten/);
    assert.equal(updater.autoInstallOnAppQuit, true);
    assert.equal(updater.allowDowngrade, false);
    updater.checkForUpdates = async () => { throw new Error('offline'); };
    await checkUpdates(); assert.match(updateStatus(), /niet gelukt/);
  } finally { dispose(); }
});
