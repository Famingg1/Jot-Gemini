'use strict';

// Shortens long pauses in 16-bit mono PCM before a dictation is uploaded.
// Thinking pauses of many seconds cost transcription minutes and can trip
// Gemini's silence limit, but they carry no words. Every pause longer than
// `minGapMs` is reduced to `keepMs` (half before, half after the gap) so
// sentence boundaries survive. Speech itself is never touched.
function compressSilence(pcm, sampleRate = 16000, { frameMs = 20, minGapMs = 1200, keepMs = 500 } = {}) {
  const frameSamples = Math.max(1, Math.round(sampleRate * frameMs / 1000));
  const totalSamples = Math.floor(pcm.length / 2);
  const frames = Math.floor(totalSamples / frameSamples);
  const unchanged = { pcm, removedMs: 0 };
  if (frames < Math.ceil(minGapMs / frameMs) + 2) return unchanged;

  const rms = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let energy = 0;
    const start = f * frameSamples;
    for (let n = 0; n < frameSamples; n++) { const v = pcm.readInt16LE((start + n) * 2); energy += v * v; }
    rms[f] = Math.sqrt(energy / frameSamples);
  }
  // Adaptive gate: three times the quiet floor, never below a fixed minimum.
  const sorted = Float64Array.from(rms).sort();
  const floor = sorted[Math.floor(frames * 0.1)];
  const threshold = Math.max(150, floor * 3);
  const speechFrames = rms.filter(value => value > threshold).length;
  if (!speechFrames) return unchanged;

  const minGapFrames = Math.ceil(minGapMs / frameMs);
  const keepFrames = Math.max(2, Math.round(keepMs / frameMs));
  const keepHead = Math.floor(keepFrames / 2), keepTail = keepFrames - keepHead;
  const ranges = [];
  let f = 0, removedFrames = 0;
  while (f < frames) {
    if (rms[f] > threshold) { f++; continue; }
    let end = f;
    while (end < frames && rms[end] <= threshold) end++;
    const length = end - f;
    if (length >= minGapFrames) { ranges.push([f + keepHead, end - keepTail]); removedFrames += length - keepFrames; }
    f = end;
  }
  if (!removedFrames) return unchanged;

  const parts = [];
  let cursor = 0;
  for (const [from, to] of ranges) { parts.push(pcm.subarray(cursor * frameSamples * 2, from * frameSamples * 2)); cursor = to; }
  parts.push(pcm.subarray(cursor * frameSamples * 2));
  return { pcm: Buffer.concat(parts), removedMs: Math.round(removedFrames * frameMs) };
}

module.exports = { compressSilence };
