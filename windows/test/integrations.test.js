'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { CalendarService, SCOPE } = require('../src/main/calendar');
const { ConnectorService, validateConfig } = require('../src/main/connectors');
const { executeTool, mcpConfig, testMcp } = require('../src/main/mcp-server');
const { atomicWriteJson } = require('../src/main/storage');
function fixture(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jot-integration-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
const safeStorage = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(text).map(b => b ^ 42), decryptString: buffer => Buffer.from(buffer).map(b => b ^ 42).toString() };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
test('OAuth loopback validates state, sends PKCE, encrypts tokens and pages recurring/all-day events', async t => {
  const root = fixture(t); let auth, verifier, pages = 0;
  const service = new CalendarService({ root, safeStorage, openExternal: async address => {
    auth = new URL(address); const callback = new URL(auth.searchParams.get('redirect_uri'));
    callback.search = new URLSearchParams({ code: 'code', state: 'wrong' }).toString(); assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set('state', auth.searchParams.get('state')); assert.equal((await fetch(callback)).status, 200);
  }, fetch: async (url, options) => {
    if (url.includes('/token')) { verifier = options.body.get('code_verifier'); return json({ access_token: 'private-token', refresh_token: 'private-refresh', expires_in: 3600 }); }
    const query = new URL(url).searchParams; assert.equal(query.get('singleEvents'), 'true'); assert.equal(query.get('orderBy'), 'startTime');
    assert.equal(options.headers.Authorization, 'Bearer private-token'); pages++;
    return pages === 1 ? json({ timeZone: 'Europe/Amsterdam', items: [{ id: 'cancelled', status: 'cancelled', start: {} }, { id: 'recurring-instance', summary: 'Standup', start: { dateTime: '2026-09-18T09:00:00+02:00' }, end: { dateTime: '2026-09-18T10:00:00+02:00' } }], nextPageToken: 'next' }) : json({ items: [{ id: 'all-day', start: { date: '2026-09-19' }, end: { date: '2026-09-20' } }] });
  } });
  service.configure({ clientId: 'test.apps.googleusercontent.com', clientSecret: 'client-private' });
  const connected = await service.connect(); assert.equal(connected.connecting, false);
  assert.equal(auth.searchParams.get('scope'), SCOPE);
  assert.equal(auth.searchParams.get('code_challenge'), crypto.createHash('sha256').update(verifier).digest('base64url'));
  assert.equal(service.status().events.length, 2); assert.equal(service.status().events[1].allDay, true); assert.equal(service.status().events[1].timeZone, 'Europe/Amsterdam');
  assert.equal(JSON.stringify(service.status()).includes('private'), false);
  assert.equal(fs.readFileSync(path.join(root, 'calendar-tokens.bin')).includes('private-token'), false);
  const restored = new CalendarService({ root, safeStorage }); assert.equal(restored.status().connected, true); assert.equal(restored.list().events.length, 2);
});
test('calendar offline failure preserves cache and disconnect clears it even if revocation fails', async t => {
  const root = fixture(t); const service = new CalendarService({ root, safeStorage, fetch: async () => { throw new Error('offline'); } });
  service.writeSecret('calendar-tokens.bin', { access_token: 'token', expiresAt: Date.now() + 3600000 });
  service.cache = { events: [{ id: 'cached' }], lastSyncedAt: '2026-09-17' };
  await assert.rejects(service.refresh(), /offline/); assert.equal(service.list().events[0].id, 'cached');
  await service.disconnect(); assert.equal(service.status().connected, false); assert.deepEqual(service.status().events, []); assert.match(service.status().error, /Disconnected locally/);
});
test('expired OAuth access token refresh preserves refresh token and rejects credential changes while connected', async t => {
  const root = fixture(t); let refreshCalls = 0;
  const service = new CalendarService({ root, safeStorage, fetch: async (url, options) => {
    if (url.includes('/token')) { refreshCalls++; assert.equal(options.body.get('refresh_token'), 'stable-refresh'); return json({ access_token: 'new-access', expires_in: 3600 }); }
    assert.equal(options.headers.Authorization, 'Bearer new-access'); return json({ items: [] });
  } });
  service.configure({ clientId: 'test.apps.googleusercontent.com' });
  service.writeSecret('calendar-tokens.bin', { access_token: 'expired', refresh_token: 'stable-refresh', expiresAt: 0 });
  await service.refresh(); assert.equal(refreshCalls, 1); assert.equal(service.readSecret('calendar-tokens.bin').refresh_token, 'stable-refresh');
  assert.throws(() => service.configure({ clientId: 'different.apps.googleusercontent.com' }), /Disconnect/);
});
test('disconnect during refresh cannot resurrect credential or event cache', async t => {
  const root = fixture(t); let finish; const pending = new Promise(resolve => { finish = resolve; });
  const service = new CalendarService({ root, safeStorage, fetch: async url => url.includes('revoke') ? json({}) : pending });
  service.writeSecret('calendar-tokens.bin', { access_token: 'token', expiresAt: Date.now() + 3600000 });
  const refresh = service.refresh(); await new Promise(resolve => setImmediate(resolve)); await service.disconnect(); finish(json({ items: [] }));
  await assert.rejects(refresh, /disconnected/); assert.equal(fs.existsSync(service.cacheFile), false); assert.equal(service.status().connected, false);
});
function seed(root, shared, title) {
  const id = crypto.randomUUID(), dir = path.join(root, 'meetings', id);
  atomicWriteJson(path.join(dir, 'meta.json'), { id, title, shared, startedAt: '2026-09-17', durationMs: 60000, secret: 'NEVER', directory: '/private/audio' });
  atomicWriteJson(path.join(dir, 'transcript.json'), { segments: [{ id: 's1', text: title + ' transcript', startMs: 0, endMs: 1000, speakerId: 'speaker1' }] });
  atomicWriteJson(path.join(dir, 'summary.json'), { summary: title + ' summary', actions: [{ text: 'Review', owner: null, deadline: null, sourceIds: ['s1'] }] });
  return id;
}
test('MCP exposes only shared notes and pages transcript; refuses path traversal and unknown tools', t => {
  const root = fixture(t), visible = seed(root, true, 'Visible'), hidden = seed(root, false, 'Hidden');
  assert.equal(executeTool(root, 'list_meetings').total, 1);
  assert.equal(executeTool(root, 'search_meetings', { query: 'Hidden' }).total, 0);
  assert.throws(() => executeTool(root, 'get_meeting', { id: hidden }), /not shared/);
  assert.throws(() => executeTool(root, 'get_meeting', { id: '../settings.json' }), /Invalid/);
  assert.equal(JSON.stringify(executeTool(root, 'get_meeting', { id: visible })).includes('NEVER'), false);
  assert.equal(executeTool(root, 'get_transcript', { id: visible, limit: 1 }).segments.length, 1);
  assert.throws(() => executeTool(root, 'get_transcript', { id: visible, limit: 101 }), /pagination/);
});
test('real spawned MCP SDK client completes handshake and enforces sharing on tool calls', async t => {
  const root = fixture(t), visible = seed(root, true, 'Shared'), hidden = seed(root, false, 'Hidden');
  const config = mcpConfig({ root });
  const result = await testMcp(config); assert.equal(result.ok, true); assert.equal(result.tools.length, 5);
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js'); const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
  const client = new Client({ name: 'integration-test', version: '1' }), transport = new StdioClientTransport(config.mcpServers.jot);
  try {
    await client.connect(transport); const list = await client.callTool({ name: 'list_meetings', arguments: {} }); assert.equal(JSON.parse(list.content[0].text).meetings[0].id, visible);
    const denied = await client.callTool({ name: 'get_meeting', arguments: { id: hidden } }); assert.equal(denied.isError, true);
    const audio = await client.callTool({ name: 'get_audio', arguments: { id: visible } }); assert.equal(audio.isError, true);
  } finally { await client.close(); await transport.close(); }
});
test('custom connector encrypts secrets, inspects real local tools and requires explicit invocation', async t => {
  const root = fixture(t); seed(root, true, 'Connector test');
  const service = new ConnectorService({ root, safeStorage }); const config = mcpConfig({ root }).mcpServers.jot;
  const [saved] = service.save({ name: 'My local notes', transport: 'stdio', ...config, env: { ...config.env, PRIVATE_KEY: 'encrypted-secret' } });
  assert.equal(saved.hasSecrets, true); assert.equal(JSON.stringify(service.list()).includes('encrypted-secret'), false); assert.equal(fs.readFileSync(service.secretFile).includes('encrypted-secret'), false);
  const inspected = await service.inspect(saved.id); assert.equal(inspected.tools.length, 5);
  await assert.rejects(service.callTool({ id: saved.id, name: 'list_meetings' }), /confirmation/);
  const call = await service.callTool({ id: saved.id, name: 'list_meetings', confirmed: true }); assert.equal(JSON.parse(call.content[0].text).total, 1);
  service.save({ ...saved, enabled: false }); await assert.rejects(service.inspect(saved.id), /disabled/);
  assert.throws(() => validateConfig({ name: 'Bad', transport: 'http', url: 'http://example.com' }), /HTTPS/);
  assert.throws(() => validateConfig({ name: 'Bad', transport: 'http', url: 'https://example.com?key=secret' }), /secret/);
});
test('unreadable encrypted connector credentials fail closed without replacing the secret file', t => {
  const root = fixture(t), service = new ConnectorService({ root, safeStorage });
  service.save({ name: 'Protected', transport: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer private' } });
  const before = fs.readFileSync(service.secretFile);
  const locked = new ConnectorService({ root, safeStorage: { ...safeStorage, decryptString: () => { throw new Error('locked'); } } });
  assert.throws(() => locked.save({ name: 'Other', transport: 'http', url: 'https://example.com/mcp' }), /could not be decrypted/);
  assert.deepEqual(fs.readFileSync(service.secretFile), before);
});
