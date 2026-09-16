'use strict';

const path = require('node:path');
const fs = require('node:fs');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme,
  safeStorage, clipboard, shell, dialog, session: electronSession, screen
} = require('electron');
const { JotStorage } = require('./storage');
const { NativeHelper } = require('./native-helper');
const { SessionManager } = require('./session-manager');
const { validateKey, normalizeError } = require('./gemini');

let mainWindow;
let hudWindow;
let tray;
let storage;
let nativeHelper;
let sessions;
let isQuitting = false;
let lastTarget = {};
const captureConsoleErrors = [];

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());
}

app.whenReady().then(async () => {
  storage = new JotStorage(app.getPath('userData'), safeStorage);
  if (process.env.JOT_CAPTURE_DIR) {
    storage.updateSettings({ onboardingComplete: true, showIdleIndicator: true });
  }
  storage.cleanupAudio();
  nativeTheme.themeSource = storage.settings.theme;
  app.setLoginItemSettings({ openAtLogin: storage.settings.launchAtLogin, path: app.getPath('exe') });

  electronSession.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const localPage = webContents === mainWindow?.webContents;
    const isAudio = permission === 'media' && (!details.mediaTypes || details.mediaTypes.includes('audio'));
    callback(Boolean(localPage && isAudio));
  });

  createMainWindow();
  createHudWindow();
  createTray();

  nativeHelper = new NativeHelper({ appPath: app.getAppPath(), resourcesPath: process.resourcesPath, packaged: app.isPackaged });
  nativeHelper.on('event', handleNativeEvent);
  nativeHelper.on('error', (error) => broadcastDiagnostic(error.message));
  nativeHelper.start(storage.settings.hotkey);

  sessions = new SessionManager({ storage, nativeHelper, clipboard });
  sessions.on('state', (state) => {
    hudWindow?.webContents.send('hud:state', state);
    mainWindow?.webContents.send('dictation:state', state);
    updateTray();
  });
  sessions.on('recording', (command) => mainWindow?.webContents.send('audio:command', command));
  sessions.on('history-changed', () => mainWindow?.webContents.send('history:changed'));
  sessions.on('diagnostic', broadcastDiagnostic);
  sessions.recoverInterrupted();

  registerIpc();
  setInterval(() => sessions.retryQueued().catch(() => {}), 30000).unref();
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 760,
    minHeight: 560,
    show: false,
    title: 'Jot',
    backgroundColor: '#F8FAFD',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  hardenWebContents(mainWindow.webContents);
  mainWindow.webContents.on('console-message', (_event, details) => {
    if (details.level === 'error') captureConsoleErrors.push(details.message);
  });
  mainWindow.once('ready-to-show', () => {
    if (!storage.settings.onboardingComplete || process.env.JOT_CAPTURE_DIR) mainWindow.show();
  });
  if (process.env.JOT_CAPTURE_DIR) {
    mainWindow.webContents.once('did-finish-load', () => setTimeout(runCaptureSuite, 900));
  }
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createHudWindow() {
  hudWindow = new BrowserWindow({
    width: 390,
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
  hudWindow.once('ready-to-show', positionHud);
  screen.on('display-metrics-changed', positionHud);
}

function positionHud() {
  if (!hudWindow) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const bounds = hudWindow.getBounds();
  hudWindow.setPosition(
    Math.round(display.workArea.x + (display.workArea.width - bounds.width) / 2),
    Math.round(display.workArea.y + display.workArea.height - bounds.height - 14),
    false
  );
}

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', '..', '..', 'docs', 'images', 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  if (trayIcon.isEmpty()) throw new Error(`Tray icon could not be loaded from ${iconPath}.`);
  tray = new Tray(trayIcon);
  tray.setToolTip('Jot — klaar om te dicteren');
  tray.on('double-click', showMainWindow);
  updateTray();
}

function updateTray() {
  if (!tray || !storage) return;
  const state = sessions?.state || 'idle';
  const label = {
    idle: `Klaar — houd ${hotkeyLabel(storage.settings.hotkey)} ingedrukt`,
    listening: 'Luisteren…', locked: 'Handsfree luisteren…', processing: 'Transcriberen…',
    inserting: 'Tekst invoegen…', success: 'Ingevoegd', offline: 'Opname wacht op verbinding', error: 'Aandacht nodig'
  }[state] || 'Jot';
  tray.setToolTip(`Jot — ${label}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label, enabled: false },
    { label: state === 'listening' || state === 'locked' ? 'Stop dictatie' : 'Start handsfree dictatie', click: () => state === 'listening' || state === 'locked' ? sessions.finish() : sessions.begin({}) },
    { label: 'Plak laatste transcript', enabled: Boolean(sessions?.lastTranscript), click: pasteLastTranscript },
    { type: 'separator' },
    { label: 'Geschiedenis', click: () => showMainWindow('history') },
    { label: 'Woordenboek', click: () => showMainWindow('dictionary') },
    { label: 'Instellingen', click: () => showMainWindow('general') },
    { type: 'separator' },
    { label: 'Afsluiten', click: () => { isQuitting = true; app.quit(); } }
  ]));
}

function handleNativeEvent(event) {
  if (!sessions) return;
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

function publicSettings() {
  return { ...storage.settings, hasApiKey: Boolean(storage.apiKey()) };
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', () => ({
    settings: publicSettings(),
    stats: storage.stats(),
    history: storage.listHistory(),
    versions: { app: app.getVersion(), electron: process.versions.electron }
  }));
  ipcMain.handle('settings:update', (_event, patch) => {
    const next = storage.updateSettings(sanitizeSettingsPatch(patch || {}));
    nativeTheme.themeSource = next.theme;
    nativeHelper.configure(next.hotkey);
    app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, path: app.getPath('exe') });
    updateTray();
    return publicSettings();
  });
  ipcMain.handle('api-key:save', async (_event, key) => {
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
  ipcMain.handle('api-key:clear', () => { storage.clearApiKey(); return { ok: true }; });
  ipcMain.handle('history:list', (_event, query) => ({ records: storage.listHistory(String(query || '')), stats: storage.stats() }));
  ipcMain.handle('history:delete', (_event, id) => { storage.deleteRecord(String(id)); return true; });
  ipcMain.handle('history:retry', async (_event, id) => { await sessions.retry(String(id)); return true; });
  ipcMain.handle('history:copy', (_event, text) => { clipboard.writeText(String(text || '')); return true; });
  ipcMain.handle('history:open-audio', async (_event, id) => {
    const record = storage.listHistory().find((item) => item.id === String(id));
    if (!record?.audioAvailable) return 'Audio is niet meer beschikbaar.';
    return shell.openPath(path.join(record.directory, 'audio.wav'));
  });
  ipcMain.handle('history:export', async (_event, id) => {
    const record = storage.listHistory().find((item) => item.id === String(id));
    if (!record) return false;
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `Jot-${record.startedAt.slice(0, 10)}.txt`, filters: [{ name: 'Tekst', extensions: ['txt'] }] });
    if (!result.canceled && result.filePath) fs.writeFileSync(result.filePath, record.finalTranscript || record.rawTranscript || '', 'utf8');
    return !result.canceled;
  });
  ipcMain.handle('dictation:start', async () => {
    mainWindow.hide();
    await new Promise((resolve) => setTimeout(resolve, 180));
    sessions.begin({});
    sessions.lock();
    return true;
  });
  ipcMain.handle('dictation:stop', () => sessions.finish());
  ipcMain.handle('dictation:cancel', () => sessions.cancel());
  ipcMain.handle('dictation:paste-last', () => pasteLastTranscript());
  ipcMain.on('audio:chunk', (_event, payload) => sessions.appendChunk(payload.data, payload.sampleRate));
  ipcMain.on('audio:level', (_event, level) => hudWindow?.webContents.send('hud:level', Number(level) || 0));
  ipcMain.handle('audio:devices', async (event) => event.sender.executeJavaScript('navigator.mediaDevices.enumerateDevices().then(ds => ds.filter(d => d.kind === "audioinput").map(d => ({id:d.deviceId,label:d.label||"Microfoon"})))'));
  ipcMain.handle('external:open', (_event, url) => {
    const allowed = ['https://aistudio.google.com/', 'https://ai.google.dev/', 'https://github.com/'];
    if (allowed.some((prefix) => String(url).startsWith(prefix))) shell.openExternal(String(url));
  });
  ipcMain.on('window:hide', () => mainWindow.hide());
  ipcMain.on('hud:show', () => { positionHud(); hudWindow.showInactive(); });
  ipcMain.on('hud:hide', () => hudWindow.hide());
  ipcMain.on('hud:start', () => sessions.begin(lastTarget));
  ipcMain.on('hud:stop', () => sessions.finish());
}

function hotkeyLabel(key) {
  return { 'right-control': 'rechter Ctrl', 'caps-lock': 'Caps Lock', f8: 'F8' }[key] || 'rechter Ctrl';
}

function sanitizeSettingsPatch(patch) {
  const clean = {};
  if (['right-control', 'caps-lock', 'f8'].includes(patch.hotkey)) clean.hotkey = patch.hotkey;
  if (typeof patch.onboardingComplete === 'boolean') clean.onboardingComplete = patch.onboardingComplete;
  if (typeof patch.smartTranscription === 'boolean') clean.smartTranscription = patch.smartTranscription;
  if (typeof patch.sounds === 'boolean') clean.sounds = patch.sounds;
  if (typeof patch.showIdleIndicator === 'boolean') clean.showIdleIndicator = patch.showIdleIndicator;
  if (typeof patch.launchAtLogin === 'boolean') clean.launchAtLogin = patch.launchAtLogin;
  if (['system', 'light', 'dark'].includes(patch.theme)) clean.theme = patch.theme;
  if (['auto', 'nl-NL', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES'].includes(patch.language)) clean.language = patch.language;
  if (typeof patch.microphoneId === 'string' && patch.microphoneId.length <= 512) clean.microphoneId = patch.microphoneId;
  if ([0, 1, 7, 30].includes(Number(patch.audioRetentionDays))) clean.audioRetentionDays = Number(patch.audioRetentionDays);
  if (typeof patch.model === 'string' && /^[a-z0-9._-]{1,100}$/iu.test(patch.model)) clean.model = patch.model;
  if (Array.isArray(patch.dictionary)) {
    clean.dictionary = [...new Set(patch.dictionary.map((term) => String(term).trim()).filter(Boolean))].slice(0, 1000).map((term) => term.slice(0, 100));
  }
  if (Array.isArray(patch.replacements)) {
    clean.replacements = patch.replacements.slice(0, 500).map((item) => ({
      from: String(item?.from || '').trim().slice(0, 100),
      to: String(item?.to || '').trim().slice(0, 100)
    })).filter((item) => item.from);
  }
  return clean;
}

function hardenWebContents(webContents) {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', (event, url) => {
    if (url !== webContents.getURL()) event.preventDefault();
  });
}

function broadcastDiagnostic(message) {
  mainWindow?.webContents.send('diagnostic', String(message));
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
    const smokeWindowHandle = browserWindowHandle(mainWindow);
    await mainWindow.webContents.executeJavaScript("document.getElementById('dictionary-term').focus()", true);
    await pause(120);
    const pasteOutcome = await sessions.insert('Jot Native Paste Test', smokeWindowHandle);
    await pause(180);
    const pastedValue = await mainWindow.webContents.executeJavaScript("document.getElementById('dictionary-term').value", true);
    // The capture runner is deliberately backgrounded by CI/terminals, so Windows
    // must reject this target instead of pasting into whatever currently has focus.
    flowResults.nativeTargetGuard = pasteOutcome === 'target-changed' && pastedValue === '';
    await mainWindow.webContents.executeJavaScript(`(() => {
      const input = document.getElementById('dictionary-term');
      input.value = 'Jot Smoke Test';
      document.getElementById('dictionary-form').requestSubmit();
    })()`, true);
    await pause(220);
    flowResults.dictionaryAdd = await mainWindow.webContents.executeJavaScript("document.getElementById('dictionary-list').innerText.includes('Jot Smoke Test')", true);
    await captureWindow(mainWindow, path.join(captureDirectory, 'windows-dictionary.png'));
    await mainWindow.webContents.executeJavaScript("document.querySelector('#dictionary-list .token button')?.click()", true);
    await pause(180);
    flowResults.dictionaryDelete = !storage.settings.dictionary.includes('Jot Smoke Test');
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

function browserWindowHandle(window) {
  const value = window.getNativeWindowHandle();
  return Number(value.length >= 8 ? value.readBigUInt64LE(0) : value.readUInt32LE(0));
}


app.on('before-quit', () => {
  isQuitting = true;
  nativeHelper?.stop();
});

app.on('window-all-closed', (event) => event.preventDefault());
