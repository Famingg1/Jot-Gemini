'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Local diagnostic log: one line per event, rotated by size, never containing secrets.
// Callers pass messages and error text only; transcripts and audio never reach this file.
const REDACTIONS = [
  [/AIza[0-9A-Za-z_-]{20,}/g, 'AIza…[verborgen]'],
  [/\bsk_[0-9a-f]{16,}/gi, 'sk_…[verborgen]'],
  [/\bxi-api-key[:=]\s*\S+/gi, 'xi-api-key: [verborgen]'],
  [/\bBearer\s+[A-Za-z0-9._-]{12,}/g, 'Bearer [verborgen]']
];

function redact(text) {
  let value = String(text ?? '');
  for (const [pattern, replacement] of REDACTIONS) value = value.replace(pattern, replacement);
  return value;
}

class Logger {
  constructor(directory, { name = 'takkieai.log', maxBytes = 1024 * 1024, keep = 3, now = () => new Date() } = {}) {
    this.directory = directory;
    this.file = path.join(directory, name);
    this.maxBytes = maxBytes;
    this.keep = keep;
    this.now = now;
    this.failed = false;
  }

  write(level, scope, message) {
    if (this.failed) return false;
    const line = `${this.now().toISOString()} ${String(level).toUpperCase().padEnd(5)} ${String(scope).padEnd(10)} ${redact(message).replace(/\r?\n/g, ' | ')}\n`;
    try {
      fs.mkdirSync(this.directory, { recursive: true });
      this.rotateIfNeeded(Buffer.byteLength(line));
      fs.appendFileSync(this.file, line, 'utf8');
      return true;
    } catch {
      this.failed = true;
      return false;
    }
  }

  info(scope, message) { return this.write('info', scope, message); }
  warn(scope, message) { return this.write('warn', scope, message); }
  error(scope, message) { return this.write('error', scope, message instanceof Error ? (message.stack || message.message) : message); }

  rotateIfNeeded(incoming) {
    let size = 0;
    try { size = fs.statSync(this.file).size; } catch { return; }
    if (size + incoming <= this.maxBytes) return;
    for (let n = this.keep - 1; n >= 1; n--) {
      const from = this.rotated(n), to = this.rotated(n + 1);
      if (fs.existsSync(from)) { if (n + 1 > this.keep) fs.rmSync(from, { force: true }); else fs.renameSync(from, to); }
    }
    fs.renameSync(this.file, this.rotated(1));
  }

  rotated(n) { return this.file.replace(/\.log$/, `.${n}.log`); }

  files() { return [this.file, ...Array.from({ length: this.keep }, (_, i) => this.rotated(i + 1))].filter(file => fs.existsSync(file)); }

  // Last `count` lines across the current file (and the previous one when the current is short).
  tail(count = 200) {
    const lines = [];
    for (const file of [this.rotated(1), this.file]) {
      try { lines.push(...fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)); } catch { /* absent */ }
    }
    return lines.slice(-count);
  }
}

module.exports = { Logger, redact };
