'use strict';

const path = require('node:path');
const fs = require('node:fs');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme,
  safeStorage, clipboard, shell, dialog, session: electronSession, screen, protocol
} = require('electron');
const { JotStorage } = require('./storage');
const { NativeHelper } = require('./native-helper');
const { SessionManager } = require('./session-manager');
const { validateKey, normalizeError } = require('./gemini');
const { validateElevenLabsKey, normalizeElevenLabsError } = require('./elevenlabs');
const { sanitizeSettingsPatch, duckLevel } = require('./settings');
const { createDesktopServices } = require('./desktop-services');
const { dockBounds, nearestAnchor } = require('./hud-layout');
let hudDrag = null;
let recordingShortcut = false;
let shortcutTimeout;

let mainWindow;
let log;
let hudWindow;
let tray;
let storage;
let nativeHelper;
let sessions;
let services;
let quitReady = false;
let quitPending = false;
let isQuitting = false;
let lastTarget = {};
const captureConsoleErrors = [];
protocol.registerSchemesAsPrivileged([{ scheme: 'jot-audio', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);
if (process.env.JOT_SMOKE && !process.env.JOT_TEST_PROFILE) throw new Error('Smoke tests require an isolated JOT_TEST_PROFILE.');
if (process.env.JOT_TEST_PROFILE) app.setPath('userData', path.resolve(process.env.JOT_TEST_PROFILE));
if (process.env.JOT_SMOKE) {
  if (!process.env.JOT_SYSTEM_TEST) app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  if (['1','1.25','1.5'].includes(process.env.JOT_DPI)) app.commandLine.appendSwitch('force-device-scale-factor', process.env.JOT_DPI);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());
}

app.whenReady().then(async () => {
  if (process.env.JOT_SMOKE) console.log('SMOKE: app ready');
  if(process.platform==='win32')app.setAppUserModelId('com.ammaar.jot');
  storage = new JotStorage(app.getPath('userData'), safeStorage);
  log = new (require('./logger').Logger)(path.join(app.getPath('userData'), 'logs'));
  log.info('app', `start ${app.getVersion()} electron ${process.versions.electron} windows ${require('node:os').release()} packaged ${app.isPackaged}`);
  process.on('uncaughtException', error => { log.error('main', error); });
  process.on('unhandledRejection', reason => { log.error('main', reason instanceof Error ? reason : String(reason)); });
  if (!storage.settings.showIdleIndicator) storage.updateSettings({ showIdleIndicator: true });
  if (process.env.JOT_CAPTURE_DIR) {
    storage.updateSettings({ onboardingComplete: true, showIdleIndicator: true });
  }
  storage.cleanupAudio();
  nativeTheme.themeSource = storage.settings.theme;
  app.setLoginItemSettings({ openAtLogin: storage.settings.launchAtLogin, path: app.getPath('exe') });

  electronSession.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const audioOnly = permission === 'media' && (!details.mediaTypes || details.mediaTypes.every(type => type === 'audio'));
    callback(Boolean((webContents === mainWindow?.webContents && audioOnly) || (services?.isCapture(webContents) && ['media','display-capture'].includes(permission))));
  });
  electronSession.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => Boolean(
    (contents === mainWindow?.webContents && permission === 'media' && details.mediaType !== 'video') ||
    (services?.isCapture(contents) && ['media','display-capture'].includes(permission))
  ));

  createMainWindow();
  createHudWindow();
  createTray();
  if (process.env.JOT_SMOKE) console.log('SMOKE: windows created');

  nativeHelper = new NativeHelper({ appPath: app.getAppPath(), resourcesPath: process.resourcesPath, packaged: app.isPackaged });
  nativeHelper.on('event', handleNativeEvent);
  nativeHelper.on('error', (error) => broadcastDiagnostic(error.message));
  nativeHelper.on('event', event => { if (event?.type === 'error') log.warn('helper', `${event.app}: ${event.title}`); });
  if (!process.env.JOT_SMOKE) nativeHelper.start(require('../renderer/hotkeys').fromSettings(storage.settings), require('../renderer/hotkeys').notesFromSettings(storage.settings));

  sessions = new SessionManager({ storage, nativeHelper, clipboard });
  sessions.on('state', (state) => {
    if (['error', 'offline', 'clipboard', 'secure'].includes(state.state)) log.warn('dictation', `${state.state}: ${state.message || ''}`);
    const listening = ['starting', 'listening', 'locked'].includes(state.state);
    nativeHelper.setDictating(listening);
    nativeHelper.duck(listening ? duckLevel(storage.settings.duckOtherAudio) : null);
    if (!services?.active()) hudWindow?.webContents.send('hud:state', state);
    mainWindow?.webContents.send('dictation:state', state);
    updateTray();
  });
  sessions.on('recording', (command) => mainWindow?.webContents.send('audio:command', command));
  sessions.on('history-changed', () => mainWindow?.webContents.send('history:changed'));
  sessions.on('diagnostic', broadcastDiagnostic);
  sessions.recoverInterrupted();

  registerIpc();
  if (process.env.JOT_SMOKE) console.log('SMOKE: IPC ready');
  services = await createDesktopServices({ storage, mainWindow, hudWindow, sessions, hardenWebContents, updateTray });
  services.manager.on('progress', value => { if (value?.error) log.warn('meeting', `${value.error.code || 'error'}: ${value.error.message || ''}`); });
  if (process.env.JOT_SMOKE) console.log('SMOKE: services ready');
  mainWindow.webContents.send('services:ready');
  if (app.isPackaged && !process.env.JOT_TEST_PROFILE) {
    require('./updates').startUpdates({ updater: require('electron-updater').autoUpdater, onStatus: () => updateTray(), onEvent: (event, detail) => log.info('updates', detail ? `${event}: ${detail}` : event) });
  }
  if (process.env.JOT_SMOKE) {
    await require('../../scripts/smoke').run({ mainWindow, hudWindow, services, storage, sessions, captureConsoleErrors });
    app.quit();
  } else if (process.env.JOT_CAPTURE_DIR) setTimeout(runCaptureSuite, 900);
  setInterval(() => { if (!services.active()) sessions.retryQueued().catch(() => {}); }, 30000).unref();
}).catch(error => {
  console.error(error);
  dialog.showErrorBox('TakkieAI kon niet starten', error.message);
  isQuitting = true; quitReady = true; app.quit();
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    show: false,
    title: 'TakkieAI',
    // Glass: Windows 11 acrylic behind a custom title bar; native window buttons stay as an overlay.
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#f5f2fa', height: 40 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  applyTitleBarTheme();
  nativeTheme.on('updated', applyTitleBarTheme);
  hardenWebContents(mainWindow.webContents);
  mainWindow.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') { captureConsoleErrors.push(details.message); log.error('renderer', `${details.message} (${details.sourceId}:${details.lineNumber})`); }
  });
  mainWindow.once('ready-to-show', () => {
    if (!app.getLoginItemSettings().wasOpenedAtLogin || process.env.JOT_CAPTURE_DIR) mainWindow.show();
  });
  mainWindow.on('close', (event) => {
    endShortcutRecording();
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('blur', endShortcutRecording);
}

function endShortcutRecording() {
  clearTimeout(shortcutTimeout);
  if (!recordingShortcut) return;
  recordingShortcut = false;
  nativeHelper?.configure(require('../renderer/hotkeys').fromSettings(storage.settings), require('../renderer/hotkeys').notesFromSettings(storage.settings));
}

function createHudWindow() {
  hudWindow = new BrowserWindow({
    width: 260,
    height: 84,
    transparent: true,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  hudWindow.setAlwaysOnTop(true, 'screen-saver');
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  hudWindow.loadFile(path.join(__dirname, '..', 'renderer', 'hud.html'));
  hardenWebContents(hudWindow.webContents);
  hudWindow.once('ready-to-show', () => { positionHud(); hudWindow.showInactive(); });
  screen.on('display-metrics-changed', positionHud);
  screen.on('display-removed', positionHud);
}

function positionHud() {
  if (!hudWindow || hudWindow.isDestroyed() || hudDrag) return;
  const display = screen.getAllDisplays().find(d => String(d.id) === storage.settings.hudDisplayId) || screen.getPrimaryDisplay();
  const side = ['left', 'right'].includes(storage.settings.hudPosition);
  const bounds = side ? { width: 84, height: 260 } : { width: 260, height: 84 };
  const dock = dockBounds(display.workArea, bounds, storage.settings.hudPosition);
  hudWindow.setBounds({ ...dock, ...bounds }, false);
}

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', '..', 'build', 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  if (trayIcon.isEmpty()) throw new Error(`Tray icon could not be loaded from ${iconPath}.`);
  tray = new Tray(trayIcon);
  tray.setToolTip('TakkieAI — klaar om te dicteren');
  tray.on('double-click', showMainWindow);
  updateTray();
}

function updateTray() {
  if (!tray || !storage) return;
  const state = sessions?.state || 'idle';
  const meetingActive = services?.active();
  const label = {
    idle: `Klaar — houd ${hotkeyLabel(storage.settings.hotkey)} ingedrukt`,
    starting:'Microfoon voorbereiden…', listening: 'Luisteren…', locked: 'Handsfree luisteren…', processing: 'Transcriberen…',
    inserting: 'Tekst invoegen…', success: 'Ingevoegd', offline: 'Opname wacht op verbinding', error: 'Aandacht nodig'
  }[state] || 'TakkieAI';
  tray.setToolTip(`TakkieAI — ${meetingActive ? 'Meeting wordt opgenomen' : label}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label, enabled: false },
    { label: state === 'starting' || state === 'listening' || state === 'locked' ? 'Stop dictatie' : 'Start handsfree dictatie', enabled: !meetingActive, click: () => state === 'listening' || state === 'locked' ? sessions.finish() : sessions.begin({}) },
    { label: meetingActive ? 'Stop meetingopname' : 'Notetaker', click: () => meetingActive ? services.manager.stop().catch(error => broadcastDiagnostic(error.message)) : showMainWindow('notetaker') },
    { label: 'Plak laatste transcript', enabled: Boolean(sessions?.lastTranscript), click: pasteLastTranscript },
    { type: 'separator' },
    { label: 'Geschiedenis', click: () => showMainWindow('history') },
    { label: 'Woordenboek', click: () => showMainWindow('dictionary') },
    { label: 'Instellingen', click: () => showMainWindow('general') },
    { label: require('./updates').updateStatus(), enabled: false },
    { label: 'Controleren op updates', click: () => require('./updates').checkUpdates() },
    { type: 'separator' },
    { label: 'Afsluiten', click: () => app.quit() }
  ]));
}

function handleNativeEvent(event) {
  if (!sessions) return;
  if(event.type==='note'){if(!recordingShortcut)noteHotkey().catch(error=>broadcastDiagnostic(error.message));return;}
  if (recordingShortcut && ['down','up','lock','escape','secure'].includes(event.type)) return;
  if (services?.active() && ['down','up','lock','escape','secure'].includes(event.type)) return;
  if (event.hwnd && ['down', 'up', 'lock', 'escape', 'secure'].includes(event.type)) lastTarget = event;
  if (event.type === 'down') {
    if (sessions.state === 'locked') sessions.finish();
    else if (!sessions.current) sessions.begin(event);
  } else if (event.type === 'up') {
    if (sessions.current && !sessions.locked) sessions.finish();
  } else if (event.type === 'lock') {
    sessions.lock();
  } else if (event.type === 'escape') {
    sessions.cancel();
  } else if (event.type === 'secure') {
    sessions.setState('secure', { message: 'Beveiligd veld — dictatie gepauzeerd' });
    sessions.returnToIdle(2600);
  }
}

// The note hotkey toggles a meeting: press to open the Notetaker, press again to stop the recording.
async function noteHotkey() {
  const action = require('./meeting-hud').noteHotkeyAction(services?.manager.state.state);
  if (action === 'stop') return services.manager.stop();
  if (action === 'ignore') return;
  return openNotetaker();
}
async function openNotetaker() {
  if (services?.manager.active) return services.panel.open(services.manager.active.id);
  if (sessions.current || ['processing','inserting'].includes(sessions.state)) throw Error('Rond eerst je dictatie af.');
  showMainWindow('notetaker');
  mainWindow.webContents.send('meeting:new');
}
function showMainWindow(section) {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  if (section) mainWindow.webContents.send('navigate', section);
}

function pasteLastTranscript() {
  if (!sessions?.lastTranscript) return;
  clipboard.writeText(sessions.lastTranscript);
  nativeHelper.paste(0);
}

// The overlaid native window buttons cannot read CSS; recolour them with the theme.
function applyTitleBarTheme() {
  if (!mainWindow || mainWindow.isDestroyed() || typeof mainWindow.setTitleBarOverlay !== 'function') return;
  const dark = storage.settings.theme === 'dark' || (storage.settings.theme !== 'light' && nativeTheme.shouldUseDarkColors);
  try { mainWindow.setTitleBarOverlay({ color: '#00000000', symbolColor: dark ? '#f5f2fa' : '#1b1226', height: 40 }); } catch { /* not supported on this platform */ }
}

function publicSettings() {
  return { ...storage.settings, hasApiKey: Boolean(storage.apiKey()), hasElevenLabsKey: Boolean(storage.elevenLabsKey()) };
}

function registerIpc() {
  // Only the packaged local top-level UI can invoke privileged actions.
  const handle = (channel, callback, hud = false) => ipcMain.handle(channel, (event, ...args) => {
    if ((event.sender !== mainWindow.webContents && !(hud && event.sender === hudWindow.webContents)) || event.senderFrame !== event.sender.mainFrame) throw new Error('Deze actie is niet toegestaan.');
    return callback(event, ...args);
  });
  handle('usage:month', (_event, month) => storage.usage.snapshot(month));
  handle('app:bootstrap', () => ({
    settings: publicSettings(),
    stats: storage.stats(),
    history: storage.listHistory(),
    nativeHelper: { available: Boolean(nativeHelper?.process), error: nativeHelper?.lastError || '' },
    versions: { app: app.getVersion(), electron: process.versions.electron }
  }), true);
  handle('settings:update', (_event, patch) => {
    if ((patch?.hotkeys !== undefined || patch?.hotkey !== undefined || patch?.noteHotkeys !== undefined) && sessions.current) throw new Error('Stop eerst je dictaat voordat je sneltoetsen wijzigt.');
    const clean = sanitizeSettingsPatch(patch || {});
    const merged = {...storage.settings,...clean};
    const keys = require('../renderer/hotkeys');
    keys.validateGroups(keys.fromSettings(merged),keys.notesFromSettings(merged));
    const next = storage.updateSettings({ ...clean, showIdleIndicator: true });
    nativeTheme.themeSource = next.theme;
    applyTitleBarTheme();
    if (!recordingShortcut && (patch.hotkeys !== undefined || patch.hotkey !== undefined || patch.noteHotkeys !== undefined)) nativeHelper.configure(require('../renderer/hotkeys').fromSettings(next),require('../renderer/hotkeys').notesFromSettings(next));
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, path: app.getPath('exe') });
    updateTray();
    mainWindow.webContents.send('settings:changed', publicSettings());
    hudWindow.webContents.send('settings:changed', publicSettings());
    positionHud(); hudWindow.showInactive();
    return publicSettings();
  });
  handle('shortcut:record', (_event, enabled) => {
    if (enabled === true) {
      if (sessions.current || services?.active()) throw new Error('Stop eerst de opname.');
      recordingShortcut = true;
      nativeHelper.send('CONFIG -');nativeHelper.send('NOTE -');
      clearTimeout(shortcutTimeout);
      shortcutTimeout = setTimeout(endShortcutRecording, 30000);
    } else endShortcutRecording();
    return true;
  });
  handle('hud:note', () => openNotetaker(), true);
  handle('api-key:save', async (_event, key) => {
    const clean = String(key || '').trim();
    if (clean.length < 20 || clean.length > 256) return { ok: false, message: 'Vul een geldige Gemini API-key in.' };
    try {
      await validateKey(clean);
      storage.saveApiKey(clean);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: normalizeError(error).message };
    }
  });
  handle('api-key:clear', () => { storage.clearApiKey(); return { ok: true }; });
  handle('elevenlabs-key:save', async (_event, key) => {
    const clean = String(key || '').trim();
    if (clean.length < 20 || clean.length > 256) return { ok: false, message: 'Vul een geldige ElevenLabs API-key in.' };
    try {
      await validateElevenLabsKey(clean);
      storage.saveElevenLabsKey(clean);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: normalizeElevenLabsError(error).message };
    }
  });
  handle('elevenlabs-key:clear', () => { storage.clearElevenLabsKey(); return { ok: true }; });
  handle('history:list', (_event, query) => ({ records: storage.listHistory(String(query || '')), stats: storage.stats() }));
  handle('history:delete', (_event, id) => { storage.deleteRecord(String(id)); return true; });
  handle('history:retry', async (_event, id) => { await sessions.retry(String(id)); return true; });
  handle('history:copy', (_event, text) => { clipboard.writeText(String(text || '')); return true; });
  handle('history:open-audio', async (_event, id) => {
    const record = storage.listHistory().find((item) => item.id === String(id));
    if (!record?.audioAvailable) return 'Audio is niet meer beschikbaar.';
    return shell.openPath(path.join(record.directory, 'audio.wav'));
  });
  handle('history:export', async (_event, id) => {
    const record = storage.listHistory().find((item) => item.id === String(id));
    if (!record) return false;
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `TakkieAI-${record.startedAt.slice(0, 10)}.txt`, filters: [{ name: 'Tekst', extensions: ['txt'] }] });
    if (!result.canceled && result.filePath) fs.writeFileSync(result.filePath, record.finalTranscript || record.rawTranscript || '', 'utf8');
    return !result.canceled;
  });
  handle('dictation:start', async () => {
    if (services?.active()) throw new Error('Rond eerst de meetingopname af.');
    mainWindow.hide();
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (services?.active()) throw new Error('Er is inmiddels een meetingopname gestart.');
    sessions.begin({});
    sessions.lock();
    return true;
  });
  handle('dictation:stop', () => sessions.finish());
  handle('dictation:cancel', () => sessions.cancel(), true);
  handle('dictation:undo-cancel', () => sessions.undoCancel(), true);
  handle('dictation:paste-last', () => pasteLastTranscript(), true);
  handle('diagnostics:report', () => diagnosticsReport());
  handle('diagnostics:open-logs', async () => { if (log) { fs.mkdirSync(log.directory, { recursive: true }); await shell.openPath(log.directory); } return true; });
  ipcMain.on('audio:status',(event,payload)=>{if(event.sender!==mainWindow.webContents||event.senderFrame!==event.sender.mainFrame)return;if(payload?.status==='ready')sessions.captureReady(payload.id);else if(payload?.status==='stopped')sessions.captureStopped(payload.id);else if(payload?.status==='stop-error')sessions.captureStopped(payload.id,false);else if(payload?.status==='error')sessions.captureFailed(payload.id);});
  ipcMain.on('audio:chunk', (event, payload) => {
    if (event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || services?.active()) return;
    if (!(payload?.data instanceof ArrayBuffer) || payload.data.byteLength > 1024 * 1024 || !Number.isFinite(payload.sampleRate) || payload.sampleRate < 8000 || payload.sampleRate > 192000) return;
    if(payload.id!==sessions.current?.id)return;
    sessions.appendChunk(payload.data, payload.sampleRate);
  });
  ipcMain.on('audio:level', (event, level) => { if (event.sender === mainWindow.webContents && !services?.active()) hudWindow?.webContents.send('hud:level', Math.max(0, Math.min(1, Number(level) || 0))); });
  handle('audio:devices', async (event) => event.sender.executeJavaScript('navigator.mediaDevices.enumerateDevices().then(ds => ds.filter(d => d.kind === "audioinput").map(d => ({id:d.deviceId,label:d.label||"Microfoon"})))'));
  handle('external:open', (_event, url) => {
    const target = new URL(String(url));
    if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Alleen beveiligde webadressen kunnen geopend worden.');
    return shell.openExternal(target.href);
  });
  const trusted = event => [mainWindow.webContents, hudWindow.webContents].includes(event.sender) && event.senderFrame === event.sender.mainFrame;
  ipcMain.on('window:hide', event => { if (trusted(event)) mainWindow.hide(); });
  ipcMain.on('window:show', event => { if (trusted(event)) showMainWindow('notetaker'); });
  ipcMain.on('hud:show', event => { if (trusted(event)) { positionHud(); hudWindow.showInactive(); } });
  ipcMain.on('hud:hide', event => { if (trusted(event)) hudWindow.showInactive(); });
  ipcMain.on('hud:drag', (event, phase) => {
    if (event.sender !== hudWindow.webContents || event.senderFrame !== event.sender.mainFrame) return;
    const point = screen.getCursorScreenPoint();
    if (phase === 'start') {
      hudDrag = { point, bounds: hudWindow.getBounds() };
      hudWindow.setIgnoreMouseEvents(false);
    } else if (phase === 'move' && hudDrag) {
      hudWindow.setPosition(Math.round(hudDrag.bounds.x + point.x - hudDrag.point.x), Math.round(hudDrag.bounds.y + point.y - hudDrag.point.y), false);
    } else if (phase === 'end' && hudDrag) {
      const moved = Math.hypot(point.x - hudDrag.point.x, point.y - hudDrag.point.y) > 5;
      hudDrag = null;
      if (moved) {
        const display = screen.getDisplayNearestPoint(point);
        storage.updateSettings({ hudPosition: nearestAnchor(display.workArea, point), hudDisplayId: String(display.id) });
        mainWindow.webContents.send('settings:changed', publicSettings());
        hudWindow.webContents.send('settings:changed', publicSettings());
      }
      positionHud();
      hudWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  });
  ipcMain.on('hud:start', event => { if (trusted(event) && !services?.active()) sessions.begin(lastTarget); });
  ipcMain.on('hud:stop', event => { if (trusted(event)) (services?.active() ? services.manager.stop() : sessions.finish()).catch(error => broadcastDiagnostic(error.message)); });
  ipcMain.on('hud:interactive', (event, interactive) => { if (event.sender === hudWindow.webContents && !hudDrag) hudWindow.setIgnoreMouseEvents(!interactive, { forward: true }); });
}

function hotkeyLabel(key) {
  if (storage?.settings.hotkeys?.length) return require('../renderer/hotkeys').label(storage.settings.hotkeys[0]);
  return { 'right-control': 'rechter Ctrl', 'caps-lock': 'Caps Lock', f8: 'F8' }[key] || 'rechter Ctrl';
}

function hardenWebContents(webContents) {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', (event, url) => {
    if (url !== webContents.getURL()) event.preventDefault();
  });
}

function broadcastDiagnostic(message) {
  log?.warn('app', message);
  mainWindow?.webContents.send('diagnostic', String(message));
}

// Version, runtime and settings summary plus the recent log, without secrets or transcripts.
function diagnosticsReport() {
  const s = storage.settings;
  const head = [
    `TakkieAI ${app.getVersion()} (${app.isPackaged ? 'geïnstalleerd' : 'ontwikkeling'})`,
    `Electron ${process.versions.electron}, Chromium ${process.versions.chrome}, Node ${process.versions.node}`,
    `Windows ${require('node:os').release()} ${process.arch}`,
    `Dictatiemodel ${s.model}, meetingmodel ${s.meetingModel}, taal ${s.language}, smart ${s.smartTranscription}`,
    `Sneltoetsen ${JSON.stringify(require('../renderer/hotkeys').fromSettings(s))}, notities ${JSON.stringify(require('../renderer/hotkeys').notesFromSettings(s))}`,
    `Gemini-key ${storage.apiKey() ? 'opgeslagen' : 'ontbreekt'}, ElevenLabs-key ${storage.elevenLabsKey() ? 'opgeslagen' : 'ontbreekt'}`,
    `Sneltoets-helper ${nativeHelper?.process ? 'actief' : 'niet gestart'}${nativeHelper?.lastError ? ', fout: ' + nativeHelper.lastError : ''}`,
    `Updates: ${require('./updates').updateStatus()}`,
    `Logmap ${log?.directory || '-'}`
  ];
  return head.join('\n') + '\n\n---- laatste logregels ----\n' + (log?.tail(200).join('\n') || '(leeg)') + '\n';
}

async function runCaptureSuite() {
  const captureDirectory = path.resolve(process.env.JOT_CAPTURE_DIR);
  const flowResults = {};
  fs.mkdirSync(captureDirectory, { recursive: true });
  try {
    mainWindow.show();
    await captureWindow(mainWindow, path.join(captureDirectory, 'windows-history-empty.png'));
    mainWindow.webContents.send('navigate', 'dictionary');
    await pause(220);
    mainWindow.show();
    mainWindow.focus();
    await mainWindow.webContents.executeJavaScript(`(() => {
      const input = document.getElementById('dictionary-term');
      input.value = 'TakkieAI Smoke Test';
      document.getElementById('dictionary-form').requestSubmit();
    })()`, true);
    await pause(220);
    flowResults.dictionaryAdd = await mainWindow.webContents.executeJavaScript("document.getElementById('dictionary-list').innerText.includes('TakkieAI Smoke Test')", true);
    await captureWindow(mainWindow, path.join(captureDirectory, 'windows-dictionary.png'));
    await mainWindow.webContents.executeJavaScript("document.querySelector('#dictionary-list .token button')?.click()", true);
    await pause(180);
    flowResults.dictionaryDelete = !storage.settings.dictionary.includes('TakkieAI Smoke Test');
    mainWindow.webContents.send('navigate', 'dictation');
    await pause(220);
    await mainWindow.webContents.executeJavaScript(`(() => {
      const toggle = document.getElementById('smart-toggle');
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    })()`, true);
    await pause(180);
    flowResults.settingMutation = storage.settings.smartTranscription === false;
    await mainWindow.webContents.executeJavaScript("document.getElementById('smart-toggle').click()", true);
    await pause(180);
    flowResults.settingReset = storage.settings.smartTranscription === true;
    await captureWindow(mainWindow, path.join(captureDirectory, 'windows-settings.png'));
    await mainWindow.webContents.executeJavaScript("document.getElementById('onboarding').hidden = false", true);
    await pause(180);
    await captureWindow(mainWindow, path.join(captureDirectory, 'windows-onboarding.png'));
    await mainWindow.webContents.executeJavaScript("document.getElementById('onboarding').hidden = true", true);
    mainWindow.setMinimumSize(360, 540);
    mainWindow.setSize(375, 720);
    await pause(260);
    await captureWindow(mainWindow, path.join(captureDirectory, 'windows-mobile-375.png'));
    hudWindow.webContents.send('hud:state', { state: 'listening' });
    hudWindow.showInactive();
    await pause(250);
    await captureWindow(hudWindow, path.join(captureDirectory, 'windows-hud-listening.png'));
    hudWindow.webContents.send('hud:state', { state: 'processing' });
    await pause(250);
    await captureWindow(hudWindow, path.join(captureDirectory, 'windows-hud-processing.png'));
    hudWindow.webContents.send('hud:state', { state: 'error', message: 'Opname bewaard in Geschiedenis' });
    await pause(250);
    await captureWindow(hudWindow, path.join(captureDirectory, 'windows-hud-error.png'));
    const bodyText = await mainWindow.webContents.executeJavaScript('document.body.innerText.slice(0, 600)', true);
    const strayText = await Promise.all([mainWindow, hudWindow].map((window) => window.webContents.executeJavaScript(
      `[...document.body.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()).map(node => node.textContent.trim())`,
      true
    )));
    flowResults.noStrayBodyText = strayText.every((items) => items.length === 0);
    fs.writeFileSync(path.join(captureDirectory, 'smoke.json'), JSON.stringify({
      title: mainWindow.getTitle(),
      bodyText,
      consoleErrors: captureConsoleErrors,
      flowResults,
      strayText,
      mainResponsiveWidth: mainWindow.getContentBounds().width,
      hudVisible: hudWindow.isVisible()
    }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(captureDirectory, 'smoke-error.txt'), error.stack || String(error));
    process.exitCode = 1;
  } finally {
    isQuitting = true;
    app.quit();
  }
}

async function captureWindow(window, output) {
  const image = await window.webContents.capturePage();
  fs.writeFileSync(output, image.toPNG());
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}


app.on('before-quit', (event) => {
  if (!quitReady && services) {
    event.preventDefault();
    if (quitPending) return;
    isQuitting = true; quitPending = true;
    services.dispose().catch(error => console.error('Meeting finalization:', error.message)).finally(() => { quitReady = true; app.quit(); });
    return;
  }
  isQuitting = true;
  nativeHelper?.stop();
});

app.on('window-all-closed', (event) => event.preventDefault());
