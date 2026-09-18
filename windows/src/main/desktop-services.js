'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { BrowserWindow, ipcMain, desktopCapturer, session, shell, safeStorage, dialog, protocol, app, powerMonitor, Notification } = require('electron');
const { MeetingStorage } = require('./meeting-storage');
const { MeetingManager } = require('./meeting-manager');
const { CalendarService } = require('./calendar');
const { ConnectorService } = require('./connectors');
const { mcpConfig, testMcp } = require('./mcp-server');
const { transformText } = require('./text-tools');

async function createDesktopServices({ storage, mainWindow, hudWindow, sessions, hardenWebContents, updateTray }) {
  const meetings = new MeetingStorage(storage.root);
  const pending = new Map();
  let disposed = false;
  let captureWindow;
  let captureReady = false;
  let processAudio = null;
  let processAudioId = null;
  const send = (channel, payload) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };
  const capture = { command: async (type, payload = {}) => {
    if(type==='start' && payload.system!==false && payload.audioApp && payload.audioApp!=='all') {
      processAudio=await require('./process-audio').startProcessAudio(payload.audioApp,pcm=>{
        if(!captureWindow.isDestroyed())captureWindow.webContents.send('meeting-capture:app-audio',{id:payload.id,pcm:new Uint8Array(pcm)});
      },message=>manager.captureFault({id:payload.id,message}).catch(()=>{}),payload.audioPid);
      processAudioId=payload.id;
      payload={...payload,nativeSystem:true,nativeLatency:payload.audioApp==='desktop-filtered'?3200:0};
    }
    if(type==='pause'&&processAudioId===payload.id)await processAudio?.pause();
    if(type==='resume'&&processAudioId===payload.id)await processAudio?.resume();
    if(type==='stop'&&processAudioId===payload.id)await processAudio?.finish();
    if(type==='abort'&&processAudioId===payload.id){processAudio?.stop();processAudio=null;processAudioId=null;}
    try{return await new Promise((resolve, reject) => {
    if (!captureReady || !captureWindow || captureWindow.isDestroyed()) return reject(new Error('De audiorecorder is niet beschikbaar. Probeer opnieuw zodra de recorder hersteld is.'));
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('De audiorecorder reageert niet; opgeslagen audio blijft bewaard.')); }, 20000);
    pending.set(requestId, { resolve, reject, timer });
    captureWindow.webContents.send('meeting-capture:command', { ...payload, type, requestId });
    });}finally{if((type==='stop'||type==='abort')&&processAudioId===payload.id){processAudio?.stop();processAudio=null;processAudioId=null;}}
  } };
  const manager = new MeetingManager({ storage: meetings, getApiKey: () => storage.apiKey(), getSettings: () => storage.settings, capture });
  const panel = require('./meeting-window').createMeetingPanel({ manager, meetings, hardenWebContents });
  const calendar = new CalendarService({ root: storage.root, safeStorage, getSettings: () => storage.settings, openExternal: url => shell.openExternal(url), onState: value => send('calendar:state', value) });
  const connectors = new ConnectorService({ root: storage.root, safeStorage });
  const active = () => Boolean(manager.active);
  let live = null;
  const changed = () => send('meetings:changed');
  manager.on('audio',payload=>{try{live?.push(payload);}catch{/* live failure never stops local capture */}});
  manager.on('changed', changed);
  manager.on('state', value => {
    if(value.state==='preparing'&&(!process.env.JOT_SMOKE||process.env.JOT_LIVE_TEST)){
      live?.closeNow();const id=value.id;let savedCount=-1,savedStatus='';
      live=new (require('./meeting-live').MeetingLive)({id,apiKey:storage.apiKey(),language:storage.settings.language,vocabulary:meetings.meta(id).participants?.map(p=>p.name).filter(Boolean)||[],save:document=>{meetings.liveViews.set(id,document);if(savedCount!==document.segments.length||savedStatus!==document.status){meetings.saveDocument(id,'live-transcript',{...document,interim:''});savedCount=document.segments.length;savedStatus=document.status;}},onChange:()=>manager.emit('changed')});live.start();
    }
    if(value.state==='idle'&&live){const closingLive=live;live=null;closingLive.finish().catch(()=>closingLive.closeNow()).finally(()=>{meetings.liveViews.delete(closingLive.id);manager.emit('changed');});}
    if(value.state==='paused')live?.flush().catch(()=>{});
    send('meeting:state', value);
    hudWindow.webContents.send('meeting:state', value);
    hudWindow.webContents.send('hud:state', value.state === 'idle' ? { state: 'idle' } : { ...value, mode: 'meeting' });
    if (['preparing','recording','paused','finalizing'].includes(value.state)) hudWindow.showInactive();
    else if (value.state === 'idle') hudWindow.showInactive();
    updateTray();
  });
  manager.on('progress', value => send('meeting:progress', value));
  manager.on('visual-level',value=>hudWindow.webContents.send('hud:level',value));
  manager.on('levels', value => { send('meeting:levels', value); hudWindow.webContents.send('meeting:levels', value); });
  const handle = (name, callback, allowHud = false) => ipcMain.handle(name, (event, ...args) => {
    if ((event.sender !== mainWindow.webContents && !(allowHud && event.sender === hudWindow.webContents)) || event.senderFrame !== event.sender.mainFrame) throw new Error('Deze actie is niet toegestaan.');
    return callback(...args);
  });
  const captureEvent = (event) => event.sender === captureWindow?.webContents && event.senderFrame === event.sender.mainFrame;
  ipcMain.on('meeting-capture:ack', (event, ack) => {
    if (!captureEvent(event)) return;
    const request = pending.get(ack?.requestId);
    if (!request) return;
    pending.delete(ack.requestId); clearTimeout(request.timer);
    if (ack.error || ack.ok === false) request.reject(new Error(typeof ack.error === 'string' ? ack.error : 'De opname kon niet starten.'));
    else request.resolve(ack);
  });
  ipcMain.handle('meeting-capture:chunk', (event, value) => {
    if (!captureEvent(event)) throw new Error('Ongeldige audiobron.');
    return manager.acceptChunk(value);
  });
  ipcMain.on('meeting-capture:levels', (event, value) => { if (captureEvent(event)) manager.levels(value); });
  ipcMain.on('meeting-capture:fault', (event, value) => { if (captureEvent(event)) Promise.resolve(manager.captureFault(value)).catch(() => {}); });

  handle('meeting:list', query => meetings.list(String(query || '').slice(0, 1000)));
  handle('meeting:get', id => meetings.get(id));
  handle('meeting:create', options => {
    const note = meetings.createNote ? meetings.createNote(options || {}) : meetings.create(options || {});
    if (!meetings.createNote) meetings.saveMeta(note.id, { state: 'ready', endedAt: new Date().toISOString() });
    changed(); return meetings.get(note.id);
  });
  const startMeeting=async (options = {},call=null) => {
    if (sessions.current || ['processing','inserting'].includes(sessions.state)) throw new Error('Rond eerst je dictatie af.');
    const audioApp=require('./settings').resolveMeetingAudioApp(options.audioApp,storage.settings.meetingAudioApp,Boolean(process.env.JOT_SMOKE&&process.env.JOT_TEST_PROFILE));
    const meetingUrl=value=>{try{const u=new URL(value.startsWith('https://')?value:'https://'+value);return u.hostname+u.pathname;}catch{return '';}};
    const calendarEvent=calendar.status().events.find(event=>event.id===options.eventId||(call?.url&&event.joinUrl&&meetingUrl(call.url)===meetingUrl(event.joinUrl)));
    const eventTitle=calendarEvent?.summary||calendarEvent?.title||null;
    const result=await manager.start({ title: eventTitle||options.title, eventTitle, autoTitle: !options.title, eventId: calendarEvent?.id||options.eventId, audioPid:call?.pid, detectedProvider:call?.provider, mic: options.microphone ?? options.mic ?? storage.settings.meetingMicrophone, system: options.systemAudio ?? options.system ?? storage.settings.meetingSystemAudio, microphoneId: storage.settings.microphoneId,audioApp,participants:calendarEvent?.attendees||[] });
    if(options.audioApp&&!call)storage.updateSettings({meetingAudioApp:audioApp});
    await panel.open(result.id).catch(() => send('diagnostic', 'Opname gestart. Het compacte venster kon niet openen; gebruik de knoppen in Notetaker.'));
    if(call){const provider={meet:'Google Meet',teams:'Teams',zoom:'Zoom',whatsapp:'WhatsApp'}[call.provider];try{if(Notification.isSupported())new Notification({title:provider+' gedetecteerd',body:'Opname gestart in TakkieAI.'}).show();}catch{}}
    return result;
  };
  handle('meeting:start',options=>startMeeting(options));
  const autoMeetings=process.env.JOT_SMOKE?null:require('./meeting-detection').startAutoMeetings({getSettings:()=>storage.settings,busy:()=>active()?'meeting':Boolean(sessions.current)||['processing','inserting'].includes(sessions.state),start:call=>startMeeting({audioApp:call.audioApp},call),onError:()=>send('diagnostic','Automatisch opnemen kon niet starten. Start de opname handmatig in Notetaker.')});
  handle('meeting:panel', id => panel.open(id));
  handle('meeting:pause', () => manager.pause(), true);
  handle('meeting:resume', () => manager.resume(), true);
  handle('meeting:stop', () => manager.stop(), true);
  handle('meeting:update', (id, patch) => { const result = meetings.update(id, patch || {}); changed(); return result; });
  handle('meeting:delete', id => manager.delete(id));
  handle('meeting:retry', id => manager.retry(id));
  handle('meeting:export', async (id, format = 'md') => {
    const item = meetings.export(id, format);
    const target = await dialog.showSaveDialog(mainWindow, { defaultPath: item.filename, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
    if (target.canceled || !target.filePath) return false;
    await fs.promises.writeFile(target.filePath, item.content, 'utf8'); return true;
  });
  function audioPlaylist(id, source = 'mix') {
    const manifest = meetings.get(id).manifest;
    if (!['mix','mic','system'].includes(source)) throw new Error('Ongeldige audiobron.');
    const count = Number(manifest.sources[source]?.samples || 0);
    return Array.from({ length: Math.ceil(count / 480000) }, (_, index) => ({
      url: `jot-audio://meeting/${id}/${source}/${index}`, source, index, offsetMs: index * 30000, durationMs: Math.min(480000, count - index * 480000) / 16
    })).filter(item => fs.existsSync(meetings.audioPath(id, source, item.index)));
  }
  handle('meeting:audio', audioPlaylist);
  handle('meeting:open-audio', (id, source = 'mix') => audioPlaylist(id, source));
  protocol.handle('jot-audio', async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'meeting') return new Response(null, { status: 404 });
      const [id, source, index, extra] = url.pathname.slice(1).split('/');
      if (extra || !/^\d{1,6}$/.test(index)) return new Response(null, { status: 404 });
      const file = meetings.audioPath(id, source, Number(index));
      const data = await fs.promises.readFile(file);
      return new Response(data, { headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(data.length), 'Cache-Control': 'no-store' } });
    } catch { return new Response(null, { status: 404 }); }
  });
  handle('calendar:status', () => calendar.status());
  handle('calendar:configure', value => calendar.configure(value || {}));
  handle('calendar:connect', () => calendar.connect());
  handle('calendar:disconnect', () => calendar.disconnect());
  handle('calendar:refresh', () => calendar.refresh());
  const config = () => mcpConfig({ executable: process.execPath, script: path.join(__dirname, 'mcp-server.js'), root: storage.root });
  handle('mcp:config', () => config());
  handle('mcp:status', () => ({ local: true, sharedMeetings: meetings.list().filter(item => item.shared).length, config: config(), connectors: connectors.list() }));
  handle('mcp:test', () => testMcp(config()));
  handle('mcp:update', () => ({ local: true, config: config(), sharedMeetings: meetings.list().filter(item => item.shared).length }));
  handle('connectors:list', () => connectors.list());
  handle('connectors:save', value => connectors.save(value));
  handle('connectors:remove', id => connectors.remove(id));
  handle('connectors:inspect', id => connectors.inspect(id));
  handle('connectors:call', value => connectors.callTool(value));
  handle('text:transform', value => transformText({ text: value?.text, instruction: value?.instruction, apiKey: storage.apiKey(), model: storage.settings.summaryModel }));

  captureWindow = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(__dirname, '..', 'capture-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false
  } });
  hardenWebContents(captureWindow.webContents);
  if (process.env.JOT_SMOKE) {
    captureWindow.webContents.on('did-fail-load', (_event, code, description) => console.log('SMOKE capture load failed', code, description));
    captureWindow.webContents.on('did-finish-load', () => console.log('SMOKE capture loaded'));
    captureWindow.webContents.on('console-message', (_event, details) => console.log('SMOKE capture console', details.message));
    setTimeout(() => console.log('SMOKE loading status', captureWindow.webContents.getURL(), captureWindow.webContents.isLoading(), mainWindow.webContents.getURL(), mainWindow.webContents.isLoading()), 5000).unref();
  }
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (request.frame !== captureWindow.webContents.mainFrame) return callback({});
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      if (!sources.length) return callback({});
      callback({ video: sources[0], audio: 'loopback' });
    } catch { callback({}); }
  });
  captureWindow.webContents.on('render-process-gone', async () => {
    captureReady = false;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('De audiorecorder werd onderbroken.')); }
    pending.clear();
    await Promise.resolve(manager.captureFault({ id: manager.active?.id, message: 'Audiorecorder onderbroken; opgeslagen audio blijft bewaard.' })).catch(() => {});
    if (!disposed && !captureWindow.isDestroyed()) {
      try { await captureWindow.loadFile(path.join(__dirname, '..', 'renderer', 'capture.html')); captureReady = true; }
      catch { send('diagnostic', 'De audiorecorder kon niet herstellen. Herstart TakkieAI; je opgeslagen audio blijft bewaard.'); }
    }
  });
  await captureWindow.loadFile(path.join(__dirname, '..', 'renderer', 'capture.html'));
  captureReady = true;
  await manager.recoverInterrupted();
  meetings.cleanupAudio(storage.settings.meetingAudioRetentionDays);
  const retryInterval = setInterval(() => manager.retryQueued().catch(() => {}), 30000);
  retryInterval.unref();
  const interval = setInterval(() => { if (calendar.status().connected) calendar.refresh().catch(() => {}); }, 300000);
  interval.unref();
  if (calendar.status().connected) calendar.refresh().catch(() => {});
  const suspend = () => { if (active()) manager.pause().catch(() => {}); };
  powerMonitor.on('suspend', suspend);
  return {
    manager, meetings, calendar, connectors, active, captureWindow, panel,
    isCapture: contents => contents === captureWindow?.webContents,
    async dispose() {
      if (disposed) return; disposed = true;
      autoMeetings?.close();clearInterval(interval); clearInterval(retryInterval); powerMonitor.removeListener('suspend', suspend);
      try {
        if (active()) {
          try { await manager.stop(); }
          catch { await manager.captureFault({ id: manager.active?.id, message: 'TakkieAI is afgesloten; opgeslagen audio is bewaard.' }); }
        }
      } finally {
        live?.closeNow();live=null;await panel.dispose();
        calendar.cancelConnect?.();
        for (const id of manager.transcriber.jobs.keys()) manager.transcriber.cancel(id);
        for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('TakkieAI wordt afgesloten.')); }
        pending.clear(); captureReady = false; captureWindow?.destroy();
        processAudio?.stop();processAudio=null;
      }
    }
  };
}

module.exports = { createDesktopServices };
