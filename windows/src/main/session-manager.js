'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { pcmToWav } = require('./wav');
const { compressSilence } = require('./silence');
const { transcribe, normalizeError } = require('./gemini');
const { canTransition } = require('./state');
const { codingSettings, expandSnippets, applyWritingStyle } = require('./text-tools');

class SessionManager extends EventEmitter {
  constructor({ storage, nativeHelper, clipboard, undoWindowMs = 3000 }) {
    super();
    this.storage = storage;
    this.nativeHelper = nativeHelper;
    this.clipboard = clipboard;
    this.undoWindowMs = undoWindowMs;
    this.pendingCancel = null;
    this.current = null;
    this.state = 'idle';
    this.locked = false;
    this.lastTranscript = '';
    this.insertResolver = null;
    this.nativeHelper.on('event', (event) => {
      if (event.type === 'insert' && this.insertResolver) {
        const resolver = this.insertResolver;
        this.insertResolver = null;
        resolver(event.app);
      }
    });
  }

  setState(next, detail = {}) {
    if (!canTransition(this.state, next)) {
      this.emit('diagnostic', `Ignored invalid state transition ${this.state} -> ${next}`);
      return false;
    }
    this.state = next;
    this.emit('state', { state: next, ...detail });
    return true;
  }

  begin(target = {}) {
    // An accidental second press must not start a new recording while the last one is still in flight.
    if (this.current || this.state === 'processing' || this.state === 'inserting') return false;
    this.finalizeCancel();
    const id = crypto.randomUUID();
    const directory = this.storage.sessionDirectory(id);
    const meta = {
      id,
      startedAt: new Date().toISOString(),
      status: 'recording',
      targetApp: target.app || '',
      targetTitle: target.title || '',
      targetWindow: Number(target.hwnd) || 0,
      durationSeconds: 0,
      sampleRate: 16000,
      rawTranscript: '',
      finalTranscript: '',
      errorCode: '',
      errorMessage: ''
    };
    this.storage.writeMeta(directory, meta);
    fs.writeFileSync(path.join(directory, 'audio.pcm'), Buffer.alloc(0));
    this.current = { id, directory, meta, frames: 0, started: Date.now() };
    this.locked = false;
    this.setState('starting', { targetApp: meta.targetApp });
    this.current.startTimer=setTimeout(()=>this.captureFailed(id),15000);this.current.startTimer.unref?.();
    this.emit('recording', { action: 'start', id, microphoneId: this.storage.settings.microphoneId });
    return true;
  }

  captureReady(id){if(this.current?.id!==id||this.current.finishing||this.state!=='starting')return;clearTimeout(this.current.startTimer);this.setState(this.locked?'locked':'listening',{ready:true});}
  captureStopped(id,ok=true){if(this.current?.id===id)this.current.stopped?.(ok);}
  captureFailed(id){if(this.current?.id!==id)return;this.cancel({ undoable: false }).then(()=>{if(!this.current){this.setState('error',{message:'Microfoon kon niet starten. Probeer opnieuw.'});this.returnToIdle();}});}

  appendChunk(chunk, sampleRate = 16000) {
    if (!this.current || this.current.meta.status !== 'recording') return;
    const buffer = Buffer.from(chunk);
    if (!buffer.length) return;
    this.current.meta.sampleRate = Number(sampleRate) || 16000;
    this.current.frames += buffer.length / 2;
    // Append every renderer block. The file is valid recoverable PCM even if
    // Electron or Windows stops the app before a WAV header can be finalized.
    fs.appendFileSync(path.join(this.current.directory, 'audio.pcm'), buffer);
  }

  lock() {
    if (!this.current || this.locked) return;
    this.locked = true;
    if(this.state!=='starting')this.setState('locked');
  }

  // Stops capture, waits for the renderer to confirm the last audio block and returns the raw PCM.
  async stopCapture(session) {
    session.finishing = true;
    this.locked = false;
    clearTimeout(session.startTimer);
    const flushed=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),10000);session.stopped=ok=>{clearTimeout(timer);resolve(ok);};this.emit('recording',{action:'stop',id:session.id});});
    if (this.current === session) this.current = null;
    const recovery = path.join(session.directory, 'audio.pcm');
    const pcm = fs.existsSync(recovery) ? fs.readFileSync(recovery) : Buffer.alloc(0);
    return { flushed, recovery, pcm };
  }

  async finish() {
    if (!this.current || this.current.finishing) return;
    const session = this.current;
    const { flushed, recovery, pcm } = await this.stopCapture(session);
    const durationSeconds = pcm.length / 2 / session.meta.sampleRate;
    session.meta.durationSeconds = durationSeconds;
    session.meta.status = 'recorded';
    if (pcm.length < session.meta.sampleRate * 2 * 0.25) {
      session.meta.status = 'silent';
      session.meta.errorCode = 'no_audio';
      session.meta.errorMessage = 'Geen spraak gedetecteerd.';
      this.storage.writeMeta(session.directory, session.meta);
      this.setState('error', { message: 'Geen spraak gehoord' });
      this.returnToIdle();
      return;
    }
    const wavPath = path.join(session.directory, 'audio.wav');
    fs.writeFileSync(wavPath, pcmToWav(pcm, session.meta.sampleRate));
    fs.unlinkSync(recovery);
    if(!flushed){session.meta.status='failed';session.meta.errorCode='capture';session.meta.errorMessage='Audio bewaard, maar het laatste audioblok kon niet worden bevestigd. Controleer de opname.';this.storage.writeMeta(session.directory,session.meta);this.emit('history-changed');this.setState('error',{message:session.meta.errorMessage});this.returnToIdle(6000);return;}
    this.storage.writeMeta(session.directory, session.meta);
    this.setState('processing');
    await this.process(session);
  }

  async cancel({ undoable = true } = {}) {
    if (!this.current || this.current.finishing) return;
    const session = this.current;
    const { flushed, recovery, pcm } = await this.stopCapture(session);
    session.meta.durationSeconds = (Date.now() - session.started) / 1000;
    session.meta.status = 'cancelled';
    const usable = undoable && flushed && pcm.length >= session.meta.sampleRate * 2 * 0.25;
    if (usable) {
      // Keep the audio ready so an accidental Escape can still be transcribed within the undo window.
      fs.writeFileSync(path.join(session.directory, 'audio.wav'), pcmToWav(pcm, session.meta.sampleRate));
      fs.unlinkSync(recovery);
      this.storage.writeMeta(session.directory, session.meta);
      const timer = setTimeout(() => this.finalizeCancel(), this.undoWindowMs);
      timer.unref?.();
      this.pendingCancel = { session, timer };
      this.setState('cancelled', { undoable: true });
      return;
    }
    this.storage.writeMeta(session.directory, session.meta);
    if (session.meta.durationSeconds < 10) this.storage.deleteRecord(session.id);
    this.setState('cancelled');
    this.returnToIdle(250);
  }

  // Closes the undo window: applies the normal cancel outcome and releases the HUD.
  finalizeCancel() {
    const pending = this.pendingCancel;
    if (!pending) return;
    this.pendingCancel = null;
    clearTimeout(pending.timer);
    if (pending.session.meta.durationSeconds < 10) this.storage.deleteRecord(pending.session.id);
    else this.emit('history-changed');
    if (this.state === 'cancelled') this.setState('idle');
  }

  async undoCancel() {
    const pending = this.pendingCancel;
    if (!pending || this.current) return false;
    this.pendingCancel = null;
    clearTimeout(pending.timer);
    const session = pending.session;
    session.meta.status = 'recorded';
    session.meta.errorCode = '';
    session.meta.errorMessage = '';
    this.storage.writeMeta(session.directory, session.meta);
    if (!this.setState('processing')) return false;
    await this.process(session);
    return true;
  }

  async process(session) {
    session.meta.status = 'transcribing';
    this.storage.writeMeta(session.directory, session.meta);
    const upload = this.prepareUpload(session);
    try {
      const transcript = await transcribe({
        apiKey: this.storage.apiKey(),
        audioPath: upload.path,
        settings: codingSettings(this.storage.settings),
        onRequest: model => this.storage.usage?.audio(model, upload.ms),
        onUsage: (model, usage) => this.storage.usage?.settle(model, usage, upload.ms)
      });
      session.meta.rawTranscript = transcript;
      let edited = applyReplacements(transcript, this.storage.settings.replacements);
      try { edited = (await applyWritingStyle(edited, this.storage.settings, this.storage.apiKey())).text; }
      catch { session.meta.styleWarning = 'Stijl kon niet worden toegepast; origineel transcript gebruikt.'; }
      session.meta.finalTranscript = expandSnippets(edited, this.storage.settings.snippets);
      session.meta.status = 'complete';
      session.meta.completedAt = new Date().toISOString();
      this.storage.writeMeta(session.directory, session.meta);
      this.lastTranscript = session.meta.finalTranscript;
      this.emit('history-changed');
      if (session.noInsert) {
        this.setState('clipboard', { message: 'Transcript gereed in Geschiedenis' });
        this.returnToIdle(2200);
        return;
      }
      this.setState('inserting');
      const outcome = await this.insert(session.meta.finalTranscript);
      if (outcome === 'ok') {
        this.setState('success', { words: countWords(session.meta.finalTranscript) });
      } else {
        this.clipboard.writeText(session.meta.finalTranscript);
        this.setState('clipboard', { message: 'Gekopieerd — druk op Ctrl+V' });
      }
      this.returnToIdle(outcome === 'ok' ? 850 : 3200);
    } catch (error) {
      const normalized = normalizeError(error);
      session.meta.status = normalized.code === 'network' ? 'queuedForRetry' : 'failed';
      session.meta.errorCode = normalized.code;
      session.meta.errorMessage = normalized.message;
      this.storage.writeMeta(session.directory, session.meta);
      this.emit('history-changed');
      this.setState(normalized.code === 'network' ? 'offline' : 'error', { message: normalized.message, sessionId: session.id });
      this.returnToIdle(6000);
    } finally {
      if (upload.temporary) fs.rmSync(upload.path, { force: true });
    }
  }

  // Dictation only: thinking pauses are shortened before upload so they cost no transcription
  // minutes. The original audio.wav stays untouched for playback and retry.
  prepareUpload(session) {
    const original = path.join(session.directory, 'audio.wav');
    const fallback = { path: original, ms: session.meta.durationSeconds * 1000, temporary: false };
    try {
      const wav = fs.readFileSync(original);
      const sampleRate = wav.readUInt32LE(24) || session.meta.sampleRate || 16000;
      const { pcm, removedMs } = compressSilence(wav.subarray(44), sampleRate);
      if (removedMs < 500) return fallback;
      const target = path.join(session.directory, 'upload.wav');
      fs.writeFileSync(target, pcmToWav(pcm, sampleRate));
      session.meta.uploadedSeconds = pcm.length / 2 / sampleRate;
      this.storage.writeMeta(session.directory, session.meta);
      return { path: target, ms: session.meta.uploadedSeconds * 1000, temporary: true };
    } catch (error) {
      this.emit('diagnostic', `Stiltes niet ingekort: ${error.message}`);
      return fallback;
    }
  }

  async insert(text) {
    const previousClipboard = snapshotClipboard(this.clipboard);
    this.clipboard.writeText(text);
    // Let Windows publish the clipboard update before synthesizing Ctrl+V.
    await new Promise((resolve) => setTimeout(resolve, 45));
    const outcome = await new Promise((resolve) => {
      this.insertResolver = resolve;
      if (this.nativeHelper.paste() === false) {
        this.insertResolver = null;
        resolve('helper-unavailable');
        return;
      }
      setTimeout(() => {
        if (this.insertResolver === resolve) {
          this.insertResolver = null;
          resolve('timeout');
        }
      }, 3000).unref();
    });
    if (outcome === 'ok') {
      setTimeout(() => restoreClipboardIfUnchanged(this.clipboard, text, previousClipboard), 650).unref();
    }
    return outcome;
  }

  async retry(id) {
    if (this.current) throw new Error('Stop the current recording before retrying.');
    const record = this.storage.listHistory().find((item) => item.id === id);
    if (!record || !record.audioAvailable) throw new Error('The recording audio is no longer available.');
    if (!['idle', 'error', 'offline', 'clipboard', 'success'].includes(this.state)) return;
    if (this.state !== 'idle') this.setState('idle');
    this.setState('processing');
    await this.process({ directory: record.directory, meta: record, noInsert: true });
  }

  async retryQueued() {
    if (this.current) return;
    const record = this.storage.listHistory().find((item) => item.status === 'queuedForRetry' && item.audioAvailable);
    if (record) await this.retry(record.id);
  }

  recoverInterrupted() {
    let recovered = 0;
    for (const record of this.storage.listHistory()) {
      if (!['recording', 'recorded', 'transcribing'].includes(record.status)) continue;
      const pcmPath = path.join(record.directory, 'audio.pcm');
      const wavPath = path.join(record.directory, 'audio.wav');
      if (!fs.existsSync(wavPath) && fs.existsSync(pcmPath)) {
        const pcm = fs.readFileSync(pcmPath);
        if (pcm.length >= (record.sampleRate || 16000) / 2) {
          fs.writeFileSync(wavPath, pcmToWav(pcm, record.sampleRate || 16000));
          fs.unlinkSync(pcmPath);
          record.durationSeconds = pcm.length / 2 / (record.sampleRate || 16000);
        }
      }
      if (fs.existsSync(wavPath)) {
        record.status = 'queuedForRetry';
        record.errorCode = 'interrupted';
        record.errorMessage = 'TakkieAI werd onderbroken; de opname is hersteld en staat klaar om opnieuw te proberen.';
        recovered += 1;
      } else {
        record.status = 'failed';
        record.errorCode = 'no_audio';
        record.errorMessage = 'De onderbroken opname bevatte geen herstelbare audio.';
      }
      delete record.directory;
      delete record.audioAvailable;
      this.storage.writeMeta(this.storage.sessionDirectory(record.id), record);
    }
    if (recovered) this.emit('history-changed');
    return recovered;
  }

  returnToIdle(delay = 800) {
    setTimeout(() => {
      if (!this.current && this.state !== 'listening' && this.state !== 'locked' && this.state !== 'processing' && this.state !== 'inserting') {
        this.setState('idle');
      }
    }, delay).unref();
  }
}

function applyReplacements(text, replacements = []) {
  let output = text;
  for (const item of replacements) {
    if (!item?.from) continue;
    output = output.replace(new RegExp(escapeRegExp(item.from), 'giu'), item.to || '');
  }
  return output;
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function countWords(text) { return text.trim().split(/\s+/u).filter(Boolean).length; }

function snapshotClipboard(clipboard) {
  const image = clipboard.readImage?.();
  return {
    text: clipboard.readText?.() || '',
    html: clipboard.readHTML?.() || '',
    rtf: clipboard.readRTF?.() || '',
    image: image && !image.isEmpty?.() ? image : undefined
  };
}

function restoreClipboardIfUnchanged(clipboard, insertedText, snapshot) {
  if (clipboard.readText?.() !== insertedText) return false;
  const data = {};
  if (snapshot.text) data.text = snapshot.text;
  if (snapshot.html) data.html = snapshot.html;
  if (snapshot.rtf) data.rtf = snapshot.rtf;
  if (snapshot.image) data.image = snapshot.image;
  if (Object.keys(data).length) clipboard.write(data);
  else clipboard.clear();
  return true;
}

module.exports = { SessionManager, applyReplacements, countWords, snapshotClipboard, restoreClipboardIfUnchanged };
