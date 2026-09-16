'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jot', {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  saveApiKey: (key) => ipcRenderer.invoke('api-key:save', key),
  clearApiKey: () => ipcRenderer.invoke('api-key:clear'),
  listHistory: (query) => ipcRenderer.invoke('history:list', query),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),
  retryHistory: (id) => ipcRenderer.invoke('history:retry', id),
  copyHistory: (text) => ipcRenderer.invoke('history:copy', text),
  openAudio: (id) => ipcRenderer.invoke('history:open-audio', id),
  exportHistory: (id) => ipcRenderer.invoke('history:export', id),
  startDictation: () => ipcRenderer.invoke('dictation:start'),
  stopDictation: () => ipcRenderer.invoke('dictation:stop'),
  cancelDictation: () => ipcRenderer.invoke('dictation:cancel'),
  pasteLast: () => ipcRenderer.invoke('dictation:paste-last'),
  audioChunk: (data, sampleRate) => ipcRenderer.send('audio:chunk', { data, sampleRate }),
  audioLevel: (level) => ipcRenderer.send('audio:level', level),
  audioDevices: () => ipcRenderer.invoke('audio:devices'),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  hideWindow: () => ipcRenderer.send('window:hide'),
  showHud: () => ipcRenderer.send('hud:show'),
  hideHud: () => ipcRenderer.send('hud:hide'),
  hudStart: () => ipcRenderer.send('hud:start'),
  hudStop: () => ipcRenderer.send('hud:stop'),
  onNavigate: (callback) => ipcRenderer.on('navigate', (_event, value) => callback(value)),
  onState: (callback) => ipcRenderer.on('dictation:state', (_event, value) => callback(value)),
  onAudioCommand: (callback) => ipcRenderer.on('audio:command', (_event, value) => callback(value)),
  onHistoryChanged: (callback) => ipcRenderer.on('history:changed', callback),
  onDiagnostic: (callback) => ipcRenderer.on('diagnostic', (_event, value) => callback(value)),
  onHudState: (callback) => ipcRenderer.on('hud:state', (_event, value) => callback(value)),
  onHudLevel: (callback) => ipcRenderer.on('hud:level', (_event, value) => callback(value))
});
