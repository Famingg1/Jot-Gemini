'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { dockBounds, nearestAnchor } = require('../src/main/hud-layout');
const { normalizeError } = require('../src/main/gemini');
test('HUD docks at bottom center and both side midpoints on a secondary display', () => {
  const area = { x: -1920, y: -200, width: 1920, height: 1040 }, size = { width: 260, height: 84 };
  const left = dockBounds(area, size, 'left'), right = dockBounds(area, size, 'right'), bottom = dockBounds(area, size, 'center');
  assert.equal(left.y + size.height / 2, area.y + area.height / 2);
  assert.equal(right.y, left.y);
  assert.equal(bottom.x + size.width / 2, area.x + area.width / 2);
  assert.ok(bottom.y > left.y);
  for (const p of [left, right, bottom]) { assert.ok(p.x >= area.x && p.x + size.width <= area.x + area.width); assert.ok(p.y >= area.y && p.y + size.height <= area.y + area.height); }
  assert.equal(nearestAnchor(area, {x:-1900,y:320}), 'left');
  assert.equal(nearestAnchor(area, {x:-20,y:320}), 'right');
  assert.equal(nearestAnchor(area, {x:-960,y:830}), 'center');
});
test('missing local credential is distinguished from provider rejection', () => {
  assert.match(normalizeError(new Error('Missing Gemini API key.')).message, /Voeg je Gemini API-key toe/);
  assert.match(normalizeError({status:403,message:'Permission denied'}).message, /geen toegang/);
});
