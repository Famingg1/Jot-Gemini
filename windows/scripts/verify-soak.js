'use strict';

// Read-only audit of a completed JOT_SOAK recording. Refuse running/incomplete evidence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function auditSoak(reportDirectory) {
  const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
  const result = read(path.join(reportDirectory, 'soak.json'));
  assert.equal(result.ok, true, 'The hour-long runtime test must have finished successfully');
  const capture = result.flows.oneHourSyntheticCapture;
  assert.ok(capture.durationMs >= 3590000);
  const checkpoint = read(path.join(reportDirectory, 'soak-progress.json'));
  assert.match(checkpoint.id, /^[a-f0-9-]{36}$/i);
  const meetingDirectory = path.join(result.profile, 'meetings', checkpoint.id);
  const meta = read(path.join(meetingDirectory, 'meta.json'));
  const manifest = read(path.join(meetingDirectory, 'manifest.json'));
  assert.equal(meta.state, 'saved');
  assert.equal(manifest.sampleRate, 16000);
  assert.equal(meta.durationMs, capture.durationMs);
  const sources = {};
  for (const source of ['mic', 'system', 'mix']) {
    const directory = path.join(meetingDirectory, 'audio', source);
    const files = fs.readdirSync(directory).filter(f => f.endsWith('.wav')).sort();
    let sampleCount = 0, energy = 0;
    for (let index = 0; index < files.length; index++) {
      assert.equal(files[index], `${String(index).padStart(6, '0')}.wav`, 'No missing or reordered segments');
      const wav = fs.readFileSync(path.join(directory, files[index]));
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
      assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
      assert.equal(wav.readUInt32LE(4), wav.length - 8);
      assert.equal(wav.readUInt16LE(20), 1, 'PCM format');
      assert.equal(wav.readUInt16LE(22), 1, 'Mono track');
      assert.equal(wav.readUInt32LE(24), 16000);
      assert.equal(wav.readUInt16LE(34), 16);
      assert.equal(wav.toString('ascii', 36, 40), 'data');
      assert.equal(wav.readUInt32LE(40), wav.length - 44);
      const samples = (wav.length - 44) / 2;
      assert.ok(Number.isInteger(samples) && samples > 0 && samples <= 480000);
      if (index < files.length - 1) assert.equal(samples, 480000, 'Intermediate segments are exactly 30 seconds');
      for (let offset = 44; offset < wav.length; offset += 2) energy += wav.readInt16LE(offset) ** 2;
      sampleCount += samples;
    }
    assert.equal(sampleCount, manifest.sources[source].samples, 'Manifest accounts for every stored PCM sample');
    assert.ok(sampleCount >= 3590 * 16000);
    assert.ok(energy > 0, 'The synthetic source contains audio');
    sources[source] = { segments: files.length, sampleCount, durationMs: sampleCount / 16, rms: Math.sqrt(energy / sampleCount) };
  }
  assert.equal(sources.mic.sampleCount, sources.mix.sampleCount);
  assert.equal(sources.system.sampleCount, sources.mix.sampleCount);
  assert.equal(sources.mix.durationMs, meta.durationMs);
  const memoryMiB = capture.samples.map(s => s.processes.reduce((sum, p) => sum + p.workingSetKiB, 0) / 1024);
  const audit = {
    ok: true, id: meta.id, auditedAt: new Date().toISOString(), sources,
    processMemoryMiB: { first: memoryMiB[0], last: memoryMiB.at(-1), min: Math.min(...memoryMiB), max: Math.max(...memoryMiB) },
    scope: 'Synthetic sources; structural continuity and equal sample counts. Does not prove physical audio quality, hardware-clock drift or absence of echo.'
  };
  fs.writeFileSync(path.join(reportDirectory, 'soak-audit.json'), JSON.stringify(audit, null, 2));
  return audit;
}

if (require.main === module) {
  try { console.log(JSON.stringify(auditSoak(path.resolve(process.argv[2] || 'screenshots/soak')), null, 2)); }
  catch (error) { console.error(`Soak audit not passed: ${error.message}`); process.exitCode = 1; }
}
module.exports = { auditSoak };
