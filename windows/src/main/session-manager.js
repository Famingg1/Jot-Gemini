'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { pcmToWav } = require('./wav');
const { transcribe, normalizeError } = require('./gemini');
const { canTransition } = require('./state');
const { codingSettings, expandSnippets, applyWritingStyle } = require('./text-tools');

class SessionManager extends EventEmitter {
  constructor({ storage, nativeHelper, clipboard }) {
    super();
    this.storage = storage;
    this.nativeHelper = nativeHelper;
    this.clipboard = clipboard;
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
    if (this.current) return false;
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
    this.setState('listening', { targetApp: meta.targetApp });
    this.emit('recording', { action: 'start', microphoneId: this.storage.settings.microphoneId });
    return true;
  }

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
    this.setState('locked');
  }

  async finish() {
    if (!this.current || this.current.finishing) return;
    const session = this.current;
    session.finishing = true;
    this.locked = false;
    this.emit('recording', { action: 'stop' });
    // Give the audio renderer one IPC turn to flush its final PCM block.
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (this.current === session) this.current = null;
    const recovery = path.join(session.directory, 'audio.pcm');
    const pcm = fs.existsSync(recovery) ? fs.readFileSync(recovery) : Buffer.alloc(0);
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
    this.storage.writeMeta(session.directory, session.meta);
    this.setState('processing');
    await this.process(session);
  }

  async cancel() {
    if (!this.current || this.current.finishing) return;
    const session = this.current;
    this.current = null;
    this.locked = false;
    this.emit('recording', { action: 'stop' });
    const durationSeconds = (Date.now() - session.started) / 1000;
    session.meta.durationSeconds = durationSeconds;
    session.meta.status = 'cancelled';
    this.storage.writeMeta(session.directory, session.meta);
    if (durationSeconds < 10) this.storage.deleteRecord(session.id);
    this.setState('cancelled');
    this.returnToIdle(250);
  }

  async process(session) {
    session.meta.status = 'transcribing';
    this.storage.writeMeta(session.directory, session.meta);
    try {
      const transcript = await transcribe({
        apiKey: this.storage.apiKey(),
        audioPath: path.join(session.directory, 'audio.wav'),
        settings: codingSettings(this.storage.settings)
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
      const outcome = await this.insert(session.meta.finalTranscript, session.meta.targetWindow);
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
    }
  }

  async insert(text, expectedWindow) {
    const previousClipboard = snapshotClipboard(this.clipboard);
    this.clipboard.writeText(text);
    // Let Windows publish the clipboard update before synthesizing Ctrl+V.
    await new Promise((resolve) => setTimeout(resolve, 45));
    const outcome = await new Promise((resolve) => {
      this.insertResolver = resolve;
      if (this.nativeHelper.paste(expectedWindow) === false) {
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
