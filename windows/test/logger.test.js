'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { Logger, redact } = require('../src/main/logger');

function setup(t, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takkie-log-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let tick = 0;
  return { root, logger: new Logger(path.join(root, 'logs'), { now: () => new Date(Date.UTC(2026, 8, 19, 8, 0, tick++)), ...options }) };
}

test('log lines carry a timestamp, level and scope, and never contain API keys', t => {
  const { logger } = setup(t);
  assert.equal(logger.info('app', 'start 0.4.28'), true);
  logger.error('gemini', new Error('401 for key AIzaSyD1234567890abcdefghijklmnop'));
  logger.warn('scribe', 'xi-api-key: sk_9b41c33735f81559b089ae629662ad82f9d57a4536918fcd rejected\nsecond line');
  const text = fs.readFileSync(logger.file, 'utf8');
  assert.match(text, /^2026-09-19T08:00:00\.000Z INFO  app        start 0\.4\.28$/m);
  assert.doesNotMatch(text, /AIzaSyD1234567890/);
  assert.doesNotMatch(text, /sk_9b41/);
  assert.match(text, /AIza…\[verborgen\]/);
  assert.match(text, /rejected \| second line/, 'multi-line messages stay on one line');
  assert.equal(redact('Bearer abcdefghijklmnop123'), 'Bearer [verborgen]');
});

test('the log rotates by size and keeps a bounded number of files', t => {
  const { logger } = setup(t, { maxBytes: 400, keep: 2 });
  for (let n = 0; n < 40; n++) logger.info('test', 'x'.repeat(50) + n);
  const files = logger.files();
  assert.ok(files.length <= 3, `files ${files.length}`);
  assert.ok(fs.statSync(logger.file).size <= 400);
  assert.ok(fs.existsSync(logger.rotated(1)));
  assert.equal(fs.existsSync(logger.rotated(3)), false);
  const tail = logger.tail(5);
  assert.equal(tail.length, 5);
  assert.match(tail.at(-1), /x{50}39$/);
});

test('a log that cannot be written fails silently and never throws into the app', t => {
  const { root } = setup(t);
  fs.writeFileSync(path.join(root, 'blocked'), 'not a directory');
  const logger = new Logger(path.join(root, 'blocked', 'logs'));
  assert.equal(logger.info('app', 'hello'), false);
  assert.equal(logger.failed, true);
  assert.deepEqual(logger.tail(), []);
});
