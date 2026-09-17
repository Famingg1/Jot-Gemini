'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { atomicWriteJson } = require('./storage');
const { wavHeader } = require('./wav');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES = ['mic', 'system', 'mix'];
const RATE = 16000;
const SEGMENT_SAMPLES = RATE * 30;
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
class MeetingStorage {
  constructor(root) { this.root = path.join(root, 'meetings'); fs.mkdirSync(this.root, { recursive: true }); }
  directory(id) { if (!UUID.test(id)) throw new Error('Invalid meeting id.'); return path.join(this.root, id); }
  create(options = {}) {
    const id = crypto.randomUUID(); const dir = this.directory(id);
    for (const source of SOURCES) fs.mkdirSync(path.join(dir, 'audio', source), { recursive: true });
    const meta = { version: 1, id, title: String(options.title || 'Nieuwe meeting').slice(0, 300), eventId: typeof options.eventId === 'string' ? options.eventId.slice(0, 1024) : null, startedAt: new Date().toISOString(), endedAt: null, durationMs: 0, state: 'preparing', mic: options.mic !== false, system: options.system !== false, audioApp: ['desktop-filtered','chrome','teams','zoom','all'].includes(options.audioApp) ? options.audioApp : 'all', shared: false, speakers: {}, error: null };
    atomicWriteJson(path.join(dir, 'meta.json'), meta);
    atomicWriteJson(path.join(dir, 'manifest.json'), { version: 1, sampleRate: RATE, sources: {}, batches: {} });
    return meta;
  }
  createNote(options = {}) { const meta = this.create(options); return this.saveMeta(meta.id, { state: 'ready', endedAt: meta.startedAt, mic: false, system: false }); }
  meta(id) { const meta = readJson(path.join(this.directory(id), 'meta.json')); if (!meta) throw new Error('Meeting niet gevonden.'); return meta; }
  saveMeta(id, patch) { const meta = { ...this.meta(id), ...patch, id }; atomicWriteJson(path.join(this.directory(id), 'meta.json'), meta); return meta; }
  manifest(id) { return readJson(path.join(this.directory(id), 'manifest.json'), { version: 1, sampleRate: RATE, sources: {}, batches: {} }); }
  saveManifest(id, manifest) { atomicWriteJson(path.join(this.directory(id), 'manifest.json'), manifest); }
  get(id) { const dir = this.directory(id); return { ...this.meta(id), manifest: this.manifest(id), transcript: readJson(path.join(dir, 'transcript.json'), { segments: [] }), summary: readJson(path.join(dir, 'summary.json'), null), notes: fs.existsSync(path.join(dir, 'notes.md')) ? fs.readFileSync(path.join(dir, 'notes.md'), 'utf8') : '' }; }
  list(query = '') { const needle = String(query).toLocaleLowerCase(); return fs.readdirSync(this.root).filter(id => UUID.test(id)).flatMap(id => { try { const item = this.get(id); if (needle && !`${item.title} ${item.notes} ${item.transcript.segments.map(s => s.text).join(' ')}`.toLocaleLowerCase().includes(needle)) return []; const { manifest, transcript, summary, notes, ...meta } = item; return [{ ...meta, segmentCount: transcript.segments.length, audioAvailable: Boolean(manifest.sources.mix?.samples) && !manifest.audioDeletedAt }]; } catch { return []; } }).sort((a,b) => b.startedAt.localeCompare(a.startedAt)); }
  update(id, patch) {
    this.meta(id); const clean = {};
    if ('title' in patch) clean.title = String(patch.title).trim().slice(0, 300) || 'Nieuwe meeting';
    if ('shared' in patch) clean.shared = patch.shared === true;
    if ('speakers' in patch) { clean.speakers = {}; for (const [key, value] of Object.entries(patch.speakers || {}).slice(0, 200)) { if (/^[a-zA-Z0-9_-]{1,100}$/.test(key)) clean.speakers[key] = String(value).slice(0, 200); } }
    if ('notes' in patch) { if (typeof patch.notes !== 'string' || patch.notes.length > 2e6) throw new Error('Notitie te groot.'); const file = path.join(this.directory(id), 'notes.md'); fs.writeFileSync(`${file}.tmp`, patch.notes); fs.renameSync(`${file}.tmp`, file); }
    this.saveMeta(id, clean); return this.get(id);
  }
  audioPath(id, source, segment) { if (!SOURCES.includes(source) || !Number.isSafeInteger(segment) || segment < 0) throw new Error('Invalid audio segment.'); return path.join(this.directory(id), 'audio', source, `${String(segment).padStart(6, '0')}.wav`); }
  saveDocument(id, name, value) { if (!['transcript', 'summary'].includes(name)) throw new Error('Invalid document.'); this.meta(id); atomicWriteJson(path.join(this.directory(id), `${name}.json`), value); }
  delete(id) { fs.rmSync(this.directory(id), { recursive: true, force: true }); }
  cleanupAudio(days, now = Date.now(), excludedIds = new Set()) {
    if (!Number.isFinite(Number(days)) || Number(days) <= 0) return;
    for (const meta of this.list()) {
      if (excludedIds.has(meta.id) || meta.state !== 'ready' || !meta.endedAt || new Date(meta.endedAt).getTime() >= now - Number(days) * 86400000) continue;
      const manifest = this.manifest(meta.id); if (manifest.audioDeletedAt) continue;
      for (const source of SOURCES) { const dir = path.join(this.directory(meta.id), 'audio', source); if (fs.existsSync(dir)) for (const file of fs.readdirSync(dir).filter(f => /^\d{6}\.wav$/.test(f))) fs.unlinkSync(path.join(dir,file)); }
      manifest.audioDeletedAt = new Date(now).toISOString(); this.saveManifest(meta.id, manifest);
    }
  }
  export(id, format = 'md') { const m = this.get(id); if (!['md','txt','json'].includes(format)) throw new Error('Invalid export format.'); const stamp = ms => new Date(ms).toISOString().slice(11,19); const text = [`# ${m.title}`, m.startedAt, '', '## Samenvatting', m.summary?.summary || '', '', '## Besluiten', ...(m.summary?.decisions || []).map(x => `- ${typeof x === 'string' ? x : x.text}`), '', '## Actiepunten', ...(m.summary?.actions || []).map(x => `- ${x.text}${x.owner ? ` (${x.owner})` : ''}${x.deadline ? ` — ${x.deadline}` : ''}`), '', '## Transcript', ...m.transcript.segments.map(s => `[${stamp(s.startMs)}] ${m.speakers[s.speakerId] || s.speakerId}: ${s.text}`), '', '## Eigen notities', m.notes].join('\n'); return { filename: `${m.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0,80) || 'meeting'}.${format}`, mimeType: format === 'json' ? 'application/json' : 'text/plain', content: format === 'json' ? JSON.stringify(m, null, 2) : format === 'txt' ? text.replace(/^#+ /gm, '') : text }; }
  recover() {
    const recovered = [];
    for (const meta of this.list()) {
      if (!['preparing','recording','paused','finalizing','transcribing','summarizing'].includes(meta.state)) continue;
      const manifest = this.manifest(meta.id);
      for (const source of SOURCES) {
        let samples = 0; const dir = path.join(this.directory(meta.id), 'audio', source);
        for (const file of fs.readdirSync(dir).filter(f => /^\d{6}\.wav$/.test(f)).sort()) {
          const target = path.join(dir,file); const size = fs.statSync(target).size; const bytes = Math.max(0, size - 44) & ~1;
          if (!bytes) { fs.unlinkSync(target); continue; }
          const fd = fs.openSync(target, 'r+'); try { fs.ftruncateSync(fd, bytes + 44); fs.writeSync(fd, wavHeader(bytes, RATE), 0, 44, 0); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
          samples += bytes / 2;
        }
        manifest.sources[source] = { samples, nextSequence: 0 };
      }
      this.saveManifest(meta.id, manifest);
      this.saveMeta(meta.id, { state: 'saved', recovered: true, endedAt: meta.endedAt || new Date().toISOString(), durationMs: (manifest.sources.mix?.samples || 0) / RATE * 1000, error: { code: 'interrupted', message: 'Opname hersteld na onderbreking. Je kunt de transcriptie opnieuw starten.' } }); recovered.push(meta.id);
    }
    return recovered;
  }
}

// Append + fsync each acknowledged block; memory never grows with recording duration.
class MeetingWriter {
  constructor(storage, id) { this.storage = storage; this.id = id; this.manifest = storage.manifest(id); this.closed = false; }
  append({ source, sequence, sampleOffset, pcm }) {
    if (this.closed || !SOURCES.includes(source)) throw new Error('Capture writer unavailable.');
    const buffer = Buffer.from(pcm); if (!buffer.length || buffer.length > RATE * 2 || buffer.length % 2) throw new Error('Invalid audio block size.');
    const state = this.manifest.sources[source] || { samples: 0, nextSequence: 0 };
    if (sequence !== state.nextSequence || sampleOffset !== state.samples) throw new Error('Audio sequence gap. Recording stopped to preserve timeline.');
    let offset = 0;
    while (offset < buffer.length) {
      const segment = Math.floor(state.samples / SEGMENT_SAMPLES); const inSegment = state.samples % SEGMENT_SAMPLES;
      const length = Math.min(buffer.length - offset, (SEGMENT_SAMPLES - inSegment) * 2); const file = this.storage.audioPath(this.id, source, segment);
      const fd = fs.openSync(file, fs.existsSync(file) ? 'r+' : 'w+');
      try { fs.writeSync(fd, buffer, offset, length, 44 + inSegment * 2); fs.writeSync(fd, wavHeader(inSegment * 2 + length, RATE), 0, 44, 0); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      state.samples += length / 2; offset += length;
    }
    state.nextSequence++; this.manifest.sources[source] = state; this.storage.saveManifest(this.id, this.manifest);
    return { sequence, samples: state.samples };
  }
  close() { this.closed = true; return this.manifest; }
}
module.exports = { MeetingStorage, MeetingWriter, RATE, SEGMENT_SAMPLES, UUID };
