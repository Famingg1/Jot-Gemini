'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { noteHotkeyAction, progressHudState } = require('../src/main/meeting-hud');

test('the meeting hotkey stops an active recording, waits while finalizing and otherwise opens the notetaker', () => {
  assert.equal(noteHotkeyAction('recording'), 'stop');
  assert.equal(noteHotkeyAction('paused'), 'stop');
  assert.equal(noteHotkeyAction('finalizing'), 'ignore');
  assert.equal(noteHotkeyAction('preparing'), 'ignore');
  assert.equal(noteHotkeyAction('idle'), 'open');
  assert.equal(noteHotkeyAction(undefined), 'open');
});

test('transcription progress keeps the HUD busy until the meeting is ready or failed', () => {
  assert.deepEqual(progressHudState({ id: 'm', state: 'transcribing', completed: 1, total: 4 }), { state: 'processing', mode: 'meeting', message: 'Meeting transcriberen… (blok 1 van 4)', holdMs: 0 });
  assert.deepEqual(progressHudState({ id: 'm', state: 'transcribing', completed: 1, total: 1 }), { state: 'processing', mode: 'meeting', message: 'Meeting transcriberen…', holdMs: 0 });
  assert.equal(progressHudState({ id: 'm', state: 'summarizing' }).message, 'Samenvatting maken…');
  assert.deepEqual(progressHudState({ id: 'm', state: 'ready' }), { state: 'success', mode: 'meeting', message: 'Meeting klaar', holdMs: 3000 });
  assert.equal(progressHudState({ id: 'm', state: 'saved', error: { code: 'network' } }).state, 'error');
  assert.equal(progressHudState({ id: 'm', state: 'saved' }), null);
  assert.equal(progressHudState(null), null);
});
