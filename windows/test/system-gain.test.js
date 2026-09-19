'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const vm = require('node:vm'); const fs = require('node:fs'); const path = require('node:path');

function processor(messages) {
  let Processor;
  const context = vm.createContext({ sampleRate: 16000, Int16Array, Float32Array, AudioWorkletProcessor: class { constructor() { this.port = { postMessage: m => messages.push(m) }; } }, registerProcessor: (_, p) => Processor = p });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer/audio-worklet.js'), 'utf8'), context);
  return new Processor({ processorOptions: { sources: [true, true] } });
}
// Alternating-sign block: RMS and peak equal the amplitude, average is zero like real audio.
const block = amplitude => { const frame = new Float32Array(128); for (let i = 0; i < 128; i++) frame[i] = i % 2 ? amplitude : -amplitude; return frame; };
// Speech-like system audio: 400 ms on, 200 ms off. Steady audio never pauses, like hiss or a tone.
function run(mic, system, seconds, { steady = false } = {}) {
  const messages = []; const p = processor(messages);
  const on = [[block(mic)], [block(system)]], off = [[block(mic)], [block(0)]];
  for (let i = 0; i < seconds * 125; i++) p.process(steady || i % 75 < 50 ? on : off);
  p.port.onmessage({ data: { type: 'flush', token: 't' } });
  const chunk = messages.filter(m => m.type === 'chunk' && m.source === 'system').at(-1); const pcm = new Int16Array(chunk.pcm);
  const peak = pcm.reduce((max, v) => Math.max(max, Math.abs(v)), 0) / 32767;
  return { peak, gain: p.systemGain };
}

test('quiet computer speech is boosted to a usable level for transcription', () => {
  const result = run(0.2, 0.001, 4);
  assert.ok(result.peak > 0.04 && result.peak <= 0.2, `peak ${result.peak}`);
});

test('computer audio is never boosted above the level of the user microphone', () => {
  const result = run(0.03, 0.001, 4);
  assert.ok(result.peak > 0.02 && result.peak <= 0.04, `peak ${result.peak}`);
});

test('loud computer audio is left untouched, even when it never pauses', () => {
  const result = run(0.25, 0.5, 4, { steady: true });
  assert.equal(result.gain, 1);
  assert.ok(Math.abs(result.peak - 0.5) < 0.001, `peak ${result.peak}`);
});

test('faint noise below the absolute gate is never lifted', () => {
  const faint = run(0.2, 0.0002, 4, { steady: true });
  assert.equal(faint.gain, 1);
  assert.ok(faint.peak < 0.0003, `faint peak ${faint.peak}`);
});

test('the boost is capped at 40 dB', () => {
  const result = run(0.2, 0.0005, 4);
  assert.ok(result.gain <= 100 && result.gain > 90, `gain ${result.gain}`);
});

test('silence is not boosted and the gain does not run away', () => {
  const result = run(0.2, 0, 3, { steady: true });
  assert.equal(result.peak, 0);
  assert.equal(result.gain, 1);
});
