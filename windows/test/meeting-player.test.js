'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { locate, total, clock } = require('../src/renderer/meeting-player');

const tracks = [
  { url: 'jot-audio://meeting/m/mix/0', index: 0, offsetMs: 0, durationMs: 30000 },
  { url: 'jot-audio://meeting/m/mix/1', index: 1, offsetMs: 30000, durationMs: 30000 },
  { url: 'jot-audio://meeting/m/mix/2', index: 2, offsetMs: 60000, durationMs: 1000 }
];

test('segments form one timeline and any position maps to the right file and offset', () => {
  assert.equal(total(tracks), 61000);
  assert.deepEqual(locate(tracks, 0), { index: 0, track: tracks[0], withinMs: 0 });
  assert.deepEqual(locate(tracks, 29999), { index: 0, track: tracks[0], withinMs: 29999 });
  assert.deepEqual(locate(tracks, 30000), { index: 1, track: tracks[1], withinMs: 0 });
  assert.deepEqual(locate(tracks, 45500), { index: 1, track: tracks[1], withinMs: 15500 });
  assert.deepEqual(locate(tracks, 60500), { index: 2, track: tracks[2], withinMs: 500 });
  assert.deepEqual(locate(tracks, 999999), { index: 2, track: tracks[2], withinMs: 999 }, 'beyond the end clamps to the last file');
  assert.deepEqual(locate(tracks, -5), { index: 0, track: tracks[0], withinMs: 0 });
  assert.equal(locate([], 10), null);
});

test('clock renders minutes and zero-padded seconds', () => {
  assert.equal(clock(0), '0:00'); assert.equal(clock(61000), '1:01'); assert.equal(clock(3599999), '59:59'); assert.equal(clock(-1), '0:00');
});
