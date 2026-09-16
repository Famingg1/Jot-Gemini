'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const defaults = Object.freeze({
  version: 1,
  onboardingComplete: false,
  hotkey: 'right-control',
  smartTranscription: true,
  sounds: true,
  showIdleIndicator: false,
  launchAtLogin: false,
  language: 'auto',
  microphoneId: 'default',
  audioRetentionDays: 7,
  theme: 'system',
  dictionary: [],
  replacements: [],
  endpoint: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-3.5-transcribe'
});

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

class JotStorage {
  constructor(root, safeStorage) {
    this.root = root;
    this.settingsFile = path.join(root, 'settings.json');
    this.secretFile = path.join(root, 'gemini-key.bin');
    this.recordingsRoot = path.join(root, 'recordings');
    this.safeStorage = safeStorage;
    fs.mkdirSync(this.recordingsRoot, { recursive: true });
    this.settings = this.readSettings();
  }

  readSettings() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  }

  updateSettings(patch) {
    const allowedKeys = new Set(Object.keys(defaults));
    const clean = Object.fromEntries(Object.entries(patch).filter(([key]) => allowedKeys.has(key)));
    this.settings = { ...this.settings, ...clean, version: defaults.version };
    atomicWriteJson(this.settingsFile, this.settings);
    return this.settings;
  }

  saveApiKey(key) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
    const encrypted = this.safeStorage.encryptString(key.trim());
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(this.secretFile, encrypted);
  }

  apiKey() {
    try {
      if (!this.safeStorage.isEncryptionAvailable()) return '';
      return this.safeStorage.decryptString(fs.readFileSync(this.secretFile));
    } catch {
      return '';
    }
  }

  clearApiKey() {
    if (fs.existsSync(this.secretFile)) fs.unlinkSync(this.secretFile);
  }

  sessionDirectory(id) {
    const directory = path.join(this.recordingsRoot, id);
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  writeMeta(directory, meta) {
    atomicWriteJson(path.join(directory, 'meta.json'), meta);
  }

  listHistory(query = '') {
    const needle = query.trim().toLocaleLowerCase();
    const records = [];
    for (const entry of fs.readdirSync(this.recordingsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        const directory = path.join(this.recordingsRoot, entry.name);
        const meta = JSON.parse(fs.readFileSync(path.join(directory, 'meta.json'), 'utf8'));
        meta.directory = directory;
        meta.audioAvailable = fs.existsSync(path.join(directory, 'audio.wav'));
        if (!needle || `${meta.finalTranscript || ''} ${meta.rawTranscript || ''} ${meta.targetApp || ''}`.toLocaleLowerCase().includes(needle)) {
          records.push(meta);
        }
      } catch { /* a partial crash folder is recovered separately */ }
    }
    return records.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  stats() {
    const complete = this.listHistory().filter((record) => record.finalTranscript);
    let words = 0;
    let spokenSeconds = 0;
    let timedWords = 0;
    for (const record of complete) {
      const count = record.finalTranscript.trim().split(/\s+/u).filter(Boolean).length;
      words += count;
      if (record.durationSeconds > 0) {
        timedWords += count;
        spokenSeconds += record.durationSeconds;
      }
    }
    return {
      words,
      dictations: complete.length,
      averageWpm: spokenSeconds > 10 ? Math.round(timedWords / (spokenSeconds / 60)) : 0
    };
  }

  deleteRecord(id) {
    const target = path.resolve(this.recordingsRoot, id);
    if (path.dirname(target) !== path.resolve(this.recordingsRoot)) throw new Error('Invalid recording id.');
    fs.rmSync(target, { recursive: true, force: true });
  }

  cleanupAudio(now = Date.now()) {
    const days = Number(this.settings.audioRetentionDays);
    if (!Number.isFinite(days) || days <= 0) return;
    const threshold = now - days * 86400000;
    for (const record of this.listHistory()) {
      if (new Date(record.startedAt).getTime() >= threshold) continue;
      const audio = path.join(record.directory, 'audio.wav');
      if (fs.existsSync(audio)) fs.unlinkSync(audio);
    }
  }
}

module.exports = { JotStorage, defaults, atomicWriteJson };
