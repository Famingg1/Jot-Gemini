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
    this.lastError = '';
  }

  start(hotkey = 'right-control', noteHotkeys = [['F9']]) {
    if (this.process) return;
    const executable = this.packaged
      ? path.join(this.resourcesPath, 'app.asar.unpacked', 'native', 'bin', 'JotNativeHelper.exe')
      : path.join(this.appPath, 'native', 'bin', 'JotNativeHelper.exe');
    try {
      this.process = spawn(executable, [Array.isArray(hotkey) ? require('../renderer/hotkeys').serialize(hotkey) : String(virtualKeys[hotkey] || virtualKeys['right-control']), require('../renderer/hotkeys').serialize(noteHotkeys)], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      this.process = null;
      this.lastError = `Windows kon de sneltoets-helper niet starten (${error.code || 'onbekend'}).`;
      this.emit('error', new Error(`Windows kon de sneltoets-helper niet starten (${error.code || 'onbekend'}). Dictatie starten via de app blijft beschikbaar.`));
      return;
    }
    this.process.stdout.setEncoding('utf8');
    this.process.stdin.on('error', () => {
      this.lastError = 'De verbinding met de sneltoets-helper is onderbroken.';
      this.emit('error', new Error(this.lastError));
    });
    this.process.stdout.on('data', (chunk) => this.consume(chunk));
    this.process.stderr.setEncoding('utf8');
    this.process.stderr.on('data', (chunk) => this.emit('error', new Error(chunk.trim())));
    this.process.on('error', (error) => {
      this.process = null;
      this.lastError = `Sneltoets-helper niet beschikbaar (${error.code || 'start mislukt'}).`;
      this.emit('error', new Error(`Sneltoets-helper niet beschikbaar: ${error.code || 'start mislukt'}. Start dictatie vanuit TakkieAI of installeer TakkieAI opnieuw.`));
    });
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
    if (!this.process?.stdin?.writable || this.process.stdin.destroyed) return false;
    try { this.process.stdin.write(`${command}\n`); return true; }
    catch { return false; }
  }

  configure(hotkey, noteHotkeys = [['F9']]) {
    this.send(`CONFIG ${Array.isArray(hotkey) ? require('../renderer/hotkeys').serialize(hotkey) : virtualKeys[hotkey] || virtualKeys['right-control']}`);
    this.send(`NOTE ${require('../renderer/hotkeys').serialize(noteHotkeys)}`);
  }

  typeText(text, expectedWindow) {
    const encoded = Buffer.from(text, 'utf8').toString('base64');
    this.send(`TYPE ${Number(expectedWindow) || 0} ${encoded}`);
  }

  paste(expectedWindow = 0) { return this.send(`PASTE ${Number(expectedWindow) || 0}`); }

  stop() {
    if (!this.process) return;
    const child = this.process;
    this.send('QUIT');
    setTimeout(() => { if (child.exitCode === null) child.kill(); }, 500).unref();
  }
}

module.exports = { NativeHelper, virtualKeys };
