'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { atomicWriteJson } = require('./storage');
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';

class CalendarService {
  constructor({ root, safeStorage, getSettings = () => ({}), openExternal, onState = () => {}, fetch: request = globalThis.fetch }) {
    Object.assign(this, { root, safeStorage, getSettings, openExternal, onState, request });
    this.cacheFile = path.join(root, 'calendar', 'cache.json');
    this.cache = { events: [], lastSyncedAt: null };
    try { this.cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')); } catch {}
    this.connecting = false;
    this.error = null;
    this.generation = 0;
  }
  readSecret(name) {
    try { return JSON.parse(this.safeStorage.decryptString(fs.readFileSync(path.join(this.root, name)))); } catch { return null; }
  }
  writeSecret(name, value) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
    fs.mkdirSync(this.root, { recursive: true });
    const target = path.join(this.root, name), temp = `${target}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temp, this.safeStorage.encryptString(JSON.stringify(value)));
    fs.renameSync(temp, target);
  }
  credentials() { return this.readSecret('calendar-client.bin') || { clientId: this.getSettings().googleCalendarClientId || '' }; }
  configure({ clientId, clientSecret = '' }) {
    if (this.connecting) throw new Error('Finish or cancel the current connection first.');
    if (typeof clientId !== 'string' || !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId.trim())) throw new Error('Enter a Google Desktop OAuth client ID.');
    if (typeof clientSecret !== 'string' || clientSecret.length > 1024) throw new Error('Invalid client secret.');
    if (this.readSecret('calendar-tokens.bin') && this.credentials().clientId !== clientId.trim()) throw new Error('Disconnect your calendar before changing the OAuth client.');
    this.writeSecret('calendar-client.bin', { clientId: clientId.trim(), clientSecret });
    this.emit();
    return this.status();
  }
  status() {
    const credentials = this.credentials();
    return { configured: Boolean(credentials.clientId), clientId: credentials.clientId || '', connected: Boolean(this.readSecret('calendar-tokens.bin')), connecting: this.connecting, events: this.cache.events, lastSyncedAt: this.cache.lastSyncedAt, error: this.error };
  }
  list() { return this.status(); }
  emit() { this.onState(this.status()); }
  async token(body) {
    const credentials = this.credentials();
    const form = new URLSearchParams({ ...body, client_id: credentials.clientId });
    if (credentials.clientSecret) form.set('client_secret', credentials.clientSecret);
    const response = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok || !result.access_token) throw new Error(result.error === 'invalid_grant' ? 'Google access expired. Connect your calendar again.' : `Google authorization failed (${response.status}).`);
    return { ...result, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  }
  async connect() {
    if (this.connecting) throw new Error('Calendar connection is already in progress.');
    if (!this.credentials().clientId) throw new Error('Configure a Google Desktop OAuth client first.');
    this.connecting = true; this.error = null; this.emit();
    const generation = ++this.generation;
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    let server, timer;
    try {
      let resolveCode, rejectCode;
      const codePromise = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
      // A handler is attached immediately, including while browser launch is pending.
      codePromise.catch(() => {});
      this.cancelConnect = () => rejectCode(new Error('Calendar connection cancelled.'));
      server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (req.method !== 'GET' || url.pathname !== '/') { res.writeHead(404).end(); return; }
        if (url.searchParams.get('state') !== state) { res.writeHead(400).end('Invalid authorization state.'); return; }
        if (url.searchParams.has('error')) { res.end('Calendar access was not granted. You can close this tab.'); rejectCode(new Error('Calendar access was not granted.')); return; }
        const code = url.searchParams.get('code');
        if (!code) { res.writeHead(400).end('Missing authorization code.'); return; }
        res.end('Authorization received. Return to TakkieAI; you can close this tab.'); resolveCode(code);
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const redirect = `http://127.0.0.1:${server.address().port}/`;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: this.credentials().clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE, state, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' }).toString();
      timer = setTimeout(() => rejectCode(new Error('Calendar sign-in timed out. Try again.')), 180000);
      await this.openExternal(url.href);
      const code = await codePromise;
      const tokens = await this.token({ code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' });
      if (generation !== this.generation) throw new Error('Calendar connection cancelled.');
      this.writeSecret('calendar-tokens.bin', tokens);
      await this.refresh();
    } catch (error) { if (generation === this.generation) this.error = error.message; throw error; }
    finally { clearTimeout(timer); server?.close(); server?.closeAllConnections(); this.cancelConnect = null; this.connecting = false; this.emit(); }
    return this.status();
  }
  async accessToken() {
    let tokens = this.readSecret('calendar-tokens.bin');
    if (!tokens) throw new Error('Connect Google Calendar first.');
    if (tokens.expiresAt > Date.now() + 60000) return tokens.access_token;
    if (!tokens.refresh_token) throw new Error('Google access expired. Connect your calendar again.');
    const generation = this.generation;
    tokens = { ...tokens, ...await this.token({ refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }) };
    if (generation !== this.generation) throw new Error('Calendar disconnected.');
    this.writeSecret('calendar-tokens.bin', tokens);
    return tokens.access_token;
  }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.fetchEvents().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  async fetchEvents() {
    const generation = this.generation;
    try {
      const token = await this.accessToken();
      const events = []; let pageToken = '', timeZone = '';
      const from = new Date(), until = new Date(from.getTime() + 14 * 86400000);
      do {
        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        url.search = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false', maxResults: '250', timeMin: from.toISOString(), timeMax: until.toISOString(), ...(pageToken ? { pageToken } : {}) }).toString();
        const response = await this.request(url.href, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(response.status === 401 ? 'Google access expired. Connect your calendar again.' : `Calendar could not refresh (${response.status}). Cached meetings remain available.`);
        const data = await response.json(); timeZone = data.timeZone || timeZone;
        for (const event of data.items || []) {
          if (event.status === 'cancelled' || !event.start) continue;
          const join = event.hangoutLink || event.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri || '';
          events.push({ id: event.id, title: event.summary || 'Untitled meeting', start: event.start.dateTime || event.start.date, end: event.end?.dateTime || event.end?.date, allDay: Boolean(event.start.date), timeZone: event.start.timeZone || timeZone, attendees: (event.attendees || []).map(a => ({ email: a.email, name: a.displayName || a.email, self: Boolean(a.self) })), joinUrl: /^https:\/\//i.test(join) ? join : '', htmlLink: event.htmlLink || '' });
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      if (generation !== this.generation) throw new Error('Calendar disconnected.');
      this.cache = { events, lastSyncedAt: new Date().toISOString() }; atomicWriteJson(this.cacheFile, this.cache); this.error = null;
      this.emit(); return this.status();
    } catch (error) { if (generation === this.generation) { this.error = error.message; this.emit(); } throw error; }
  }
  async disconnect() {
    const tokens = this.readSecret('calendar-tokens.bin');
    const generation = ++this.generation; this.cancelConnect?.();
    fs.rmSync(path.join(this.root, 'calendar-tokens.bin'), { force: true });
    fs.rmSync(this.cacheFile, { force: true });
    this.cache = { events: [], lastSyncedAt: null }; this.error = null; this.emit();
    if (tokens) {
      try {
        const response = await this.request('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token: tokens.refresh_token || tokens.access_token }), signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('revoke failed');
      } catch { if (generation === this.generation) this.error = 'Disconnected locally. Google permission could not be revoked; remove TakkieAI in your Google account if needed.'; }
    }
    this.emit(); return this.status();
  }
}
module.exports = { CalendarService, SCOPE };
