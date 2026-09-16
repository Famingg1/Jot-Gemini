'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');

const virtualKeys = Object.freeze({
  'right-control': 0xA3,
  'caps-lock': 0x14,
  f8: 0x77
});

class NativeHelper extends EventEmitter {
  constructor({ appPath, resourcesPath, packaged }) {
    super();
    this.appPath = appPath;
    this.resourcesPath = resourcesPath;
    this.packaged = packaged;
    this.process = null;
    this.pending = '';
  }

  start(hotkey = 'right-control') {
    if (this.process) return;
    const executable = this.packaged
      ? path.join(this.resourcesPath, 'app.asar.unpacked', 'native', 'bin', 'JotNativeHelper.exe')
      : path.join(this.appPath, 'native', 'bin', 'JotNativeHelper.exe');
    this.process = spawn(executable, [String(virtualKeys[hotkey] || virtualKeys['right-control'])], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.process.stdout.setEncoding('utf8');
    this.process.stdout.on('data', (chunk) => this.consume(chunk));
    this.process.stderr.setEncoding('utf8');
    this.process.stderr.on('data', (chunk) => this.emit('error', new Error(chunk.trim())));
    this.process.on('exit', (code) => {
      this.process = null;
      if (code && code !== 0) this.emit('error', new Error(`Native helper stopped with exit code ${code}.`));
    });
  }

  consume(chunk) {
    this.pending += chunk;
    const lines = this.pending.split(/\r?\n/u);
    this.pending = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try { this.emit('event', JSON.parse(line)); } catch { this.emit('error', new Error(`Invalid native helper message: ${line}`)); }
    }
  }

  send(command) {
    if (this.process?.stdin?.writable) this.process.stdin.write(`${command}\n`);
  }

  configure(hotkey) {
    this.send(`CONFIG ${virtualKeys[hotkey] || virtualKeys['right-control']}`);
  }

  typeText(text, expectedWindow) {
    const encoded = Buffer.from(text, 'utf8').toString('base64');
    this.send(`TYPE ${Number(expectedWindow) || 0} ${encoded}`);
  }

  paste(expectedWindow = 0) { this.send(`PASTE ${Number(expectedWindow) || 0}`); }

  stop() {
    if (!this.process) return;
    this.send('QUIT');
    setTimeout(() => this.process?.kill(), 500).unref();
  }
}

module.exports = { NativeHelper, virtualKeys };
