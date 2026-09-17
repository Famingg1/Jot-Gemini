'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('meetingPanel', {
  action: (action, value) => ipcRenderer.invoke('meeting-panel:action', action, value),
  onChanged: callback => ipcRenderer.on('meeting-panel:changed', () => callback()),
  onLevels: callback => ipcRenderer.on('meeting-panel:levels', (_event, value) => callback(value)),
  onClose: callback => ipcRenderer.on('meeting-panel:close', () => callback())
});
