'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function walk(root) { return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(root, entry.name)) : entry.name.endsWith('.js') ? [path.join(root, entry.name)] : []); }
for (const file of [...walk('src'), ...walk('scripts')]) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) { process.stderr.write(result.stderr || String(result.error)); process.exitCode = 1; }
}
