'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { atomicWriteJson } = require('./storage');
function validateConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid connector.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100) throw new Error('Enter a connector name (maximum 100 characters).');
  const config = { id: input.id || crypto.randomUUID(), name: input.name.trim(), transport: input.transport, enabled: input.enabled !== false };
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(config.id)) throw new Error('Invalid connector ID.');
  if (config.transport === 'stdio') {
    if (typeof input.command !== 'string' || !input.command.trim() || input.command.length > 2048 || /[\r\n\0]/.test(input.command)) throw new Error('Enter an executable, without shell command syntax.');
    if (input.args !== undefined && (!Array.isArray(input.args) || input.args.length > 100 || input.args.some(a => typeof a !== 'string' || a.length > 8192 || a.includes('\0')))) throw new Error('Arguments must be an array of strings.');
    config.command = input.command.trim(); config.args = input.args || [];
  } else if (config.transport === 'http') {
    let url; try { url = new URL(input.url); } catch { throw new Error('Enter a valid MCP URL.'); }
    if (url.username || url.password || url.hash || url.search) throw new Error('Put authentication in secret headers, not the URL.');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Remote MCP servers require HTTPS.');
    config.url = url.href;
  } else throw new Error('Choose stdio or HTTP transport.');
  return config;
}
function validateSecrets(input) {
  const output = {};
  for (const kind of ['headers', 'env']) {
    const values = input[kind] || {};
    if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length > 100) throw new Error(`Invalid ${kind}.`);
    output[kind] = {};
    for (const [name, value] of Object.entries(values)) {
      if (!/^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(name) || typeof value !== 'string' || value.length > 8192 || /[\0\r\n]/.test(value)) throw new Error(`Invalid ${kind} entry.`);
      if (kind === 'headers' && ['host', 'content-length', 'connection'].includes(name.toLowerCase())) throw new Error('This HTTP header is reserved.');
      output[kind][name] = value;
    }
  }
  return output;
}
class ConnectorService {
  constructor({ root, safeStorage }) { this.root = root; this.safeStorage = safeStorage; this.file = path.join(root, 'mcp', 'connectors.json'); this.secretFile = path.join(root, 'connectors-secrets.bin'); }
  records() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return []; } }
  secrets() {
    if (!fs.existsSync(this.secretFile)) return {};
    try { return JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.secretFile))); }
    catch { throw new Error('Connector credentials could not be decrypted for this Windows account. Existing credentials were preserved.'); }
  }
  saveSecrets(secrets) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
    fs.mkdirSync(this.root, { recursive: true });
    const temp = `${this.secretFile}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temp, this.safeStorage.encryptString(JSON.stringify(secrets))); fs.renameSync(temp, this.secretFile);
  }
  list() { const secrets = this.secrets(); return this.records().map(c => ({ ...c, hasSecrets: Boolean(Object.keys(secrets[c.id]?.headers || {}).length || Object.keys(secrets[c.id]?.env || {}).length) })); }
  save(input) {
    const config = validateConfig(input), secrets = this.secrets(), records = this.records();
    if (input.headers !== undefined || input.env !== undefined) secrets[config.id] = validateSecrets({ ...secrets[config.id], ...input });
    this.saveSecrets(secrets);
    const index = records.findIndex(c => c.id === config.id); if (index < 0) records.push(config); else records[index] = config;
    atomicWriteJson(this.file, records); return this.list();
  }
  remove(id) { const secrets = this.secrets(); delete secrets[id]; this.saveSecrets(secrets); atomicWriteJson(this.file, this.records().filter(c => c.id !== id)); return this.list(); }
  async withClient(id, work) {
    const config = this.records().find(c => c.id === id);
    if (!config || !config.enabled) throw new Error('Connector is missing or disabled.');
    validateConfig(config);
    const secrets = this.secrets()[id] || {};
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const client = new Client({ name: 'jot-connectors', version: '1.0.0' });
    let transport;
    if (config.transport === 'stdio') {
      const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
      transport = new StdioClientTransport({ command: config.command, args: config.args, env: secrets.env, stderr: 'pipe' });
    } else {
      const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
      transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers: secrets.headers || {}, redirect: 'error' } });
    }
    try { await client.connect(transport, { timeout: 15000 }); return await work(client); }
    catch (error) {
      // A provider can echo secrets in an error. Redact before returning to the UI.
      let message = String(error.message || 'Connector failed.');
      for (const value of [...Object.values(secrets.headers || {}), ...Object.values(secrets.env || {})]) if (value) message = message.split(value).join('[redacted]');
      throw new Error(message.slice(0, 1500));
    } finally { await client.close(); await transport.close(); }
  }
  async inspect(id) {
    return this.withClient(id, async client => {
      const tools = []; let cursor;
      do { const page = await client.listTools(cursor ? { cursor } : {}, { timeout: 15000 }); tools.push(...page.tools); cursor = page.nextCursor; if (tools.length > 10000) throw new Error('Server returned too many tools.'); } while (cursor);
      return { tools, testedAt: new Date().toISOString() };
    });
  }
  async callTool({ id, name, arguments: args = {}, confirmed }) {
    if (confirmed !== true) throw new Error('Explicit user confirmation is required to run a connector tool.');
    if (typeof name !== 'string' || !name || name.length > 200 || !args || typeof args !== 'object' || Array.isArray(args) || JSON.stringify(args).length > 65536) throw new Error('Invalid tool call.');
    return this.withClient(id, client => client.callTool({ name, arguments: args }, undefined, { timeout: 60000 }));
  }
}
module.exports = { ConnectorService, validateConfig, validateSecrets };
