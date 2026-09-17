'use strict';
const { EventEmitter } = require('node:events');
const { MeetingWriter, RATE } = require('./meeting-storage');
const { MeetingTranscriber } = require('./meeting-transcriber');
class MeetingManager extends EventEmitter {
  constructor({ storage, getApiKey, getSettings, capture, transcriber }) { super(); Object.assign(this, { storage, capture, getSettings }); this.active = null; this.transition = null; this.transcriber = transcriber || new MeetingTranscriber({ storage, getApiKey, getSettings, onProgress: progress => { this.emit('progress', progress); this.emit('changed'); } }); }
  get state() { return this.active ? this.storage.meta(this.active.id) : { state: 'idle', id: null }; }
  publish() { const state = this.state; this.emit('state', state); this.emit('changed'); return state; }
  async start(options = {}) {
    if (this.active) throw new Error('Er is al een meetingopname actief.');
    if (options.mic === false && options.system === false) throw new Error('Kies ten minste één audiobron.');
    const meta = this.storage.create(options); this.active = { id: meta.id, writer: new MeetingWriter(this.storage, meta.id) }; this.publish();
    try { await this.capture.command('start', { ...options, id: meta.id }); if (this.active?.id !== meta.id) throw new Error('Opname is tijdens het starten onderbroken.'); this.storage.saveMeta(meta.id, { state: 'recording' }); return this.publish(); }
    catch (error) { await this.captureFault({ id: meta.id, message: error.message }); throw error; }
  }
  async changeCapture(type, required, next) {
    if (this.transition || this.state.state !== required) throw new Error('Wacht tot de opnameactie klaar is.');
    const id = this.active.id; this.transition = type;
    try { await this.capture.command(type, { id }); if (this.active?.id !== id) throw new Error('Opname onderbroken.'); this.storage.saveMeta(id, { state: next }); return this.publish(); }
    catch (error) { await this.captureFault({ id, message: error.message }); throw error; }
    finally { this.transition = null; }
  }
  pause() { return this.changeCapture('pause', 'recording', 'paused'); }
  resume() { return this.changeCapture('resume', 'paused', 'recording'); }
  acceptChunk(payload) { if (!this.active || payload.id !== this.active.id) throw new Error('Onbekende opname.'); try { const result=this.active.writer.append(payload);this.emit('audio',payload);return result; } catch (error) { this.captureFault({ id: payload.id, message: error.message }).catch(() => {}); throw error; } }
  levels(payload) { if (payload.id === this.active?.id) this.emit('levels', { id: payload.id, mic: Math.max(0,Math.min(1,Number(payload.mic) || 0)), system: Math.max(0,Math.min(1,Number(payload.system) || 0)), durationMs: Math.max(0, Number(payload.durationMs) || 0), interruptedSource: ['mic','system'].includes(payload.interruptedSource) ? payload.interruptedSource : null }); }
  async stop() {
    if (this.transition || !this.active || !['recording','paused'].includes(this.state.state)) throw new Error('Wacht tot de opname klaar is om te stoppen.');
    const id = this.active.id;
    try {
      this.storage.saveMeta(id, { state: 'finalizing' }); this.publish();
      await this.capture.command('stop', { id });
      if (!this.active || this.active.id !== id) return this.storage.get(id);
      const manifest = this.active.writer.close();
      this.storage.saveMeta(id, { state: 'saved', endedAt: new Date().toISOString(), durationMs: (manifest.sources.mix?.samples || 0) / RATE * 1000 }); this.active = null; this.publish();
    } catch (error) { await this.captureFault({ id, message: error.message }); throw error; }
    if (this.getSettings().meetingAutoTranscribe !== false) this.transcriber.process(id).catch(() => {}); return this.storage.get(id);
  }
  async captureFault({ id, message }) {
    if (!this.active || id !== this.active.id) return;
    const writer = this.active.writer; this.active = null;
    const failure = { code: 'capture', message: String(message || 'Audiobron onderbroken.').slice(0, 1000) };
    try { const manifest = writer.close(); this.storage.saveMeta(id, { state: 'saved', endedAt: new Date().toISOString(), durationMs: (manifest.sources.mix?.samples || 0) / RATE * 1000, error: failure }); this.publish(); }
    catch { this.emit('state', { state: 'idle', id: null, failedMeetingId: id, error: failure }); this.emit('changed'); }
    try { await this.capture.command('abort', { id }); } catch { /* crash already saved */ }
  }
  recoverInterrupted() { const ids = this.storage.recover(); this.emit('changed'); return ids; }
  async retry(id) { if (this.active?.id === id) throw new Error('Stop eerst de opname.'); this.storage.saveMeta(id, { retryCount: 0, nextRetryAt: null }); this.transcriber.process(id).catch(() => {}); return this.storage.get(id); }
  async retryQueued(now = Date.now()) {
    if (this.getSettings().meetingAutoTranscribe === false) return;
    for (const meta of this.storage.list()) if (meta.id !== this.active?.id && meta.state === 'saved' && meta.nextRetryAt && new Date(meta.nextRetryAt).getTime() <= now && ['network','rate_limit'].includes(meta.error?.code)) await this.transcriber.process(meta.id);
  }
  delete(id) { if (this.active?.id === id) throw new Error('Stop eerst de opname.'); this.transcriber.cancel(id); this.storage.delete(id); this.emit('changed'); }
}
module.exports = { MeetingManager };
