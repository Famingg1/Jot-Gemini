'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('meetingCapture', {
  onCommand: callback => ipcRenderer.on('meeting-capture:command', (_event, command) => callback(command)),
  ack: payload => ipcRenderer.send('meeting-capture:ack', payload),
  chunk: payload => ipcRenderer.invoke('meeting-capture:chunk', payload),
  levels: payload => ipcRenderer.send('meeting-capture:levels', payload),
  fault: payload => ipcRenderer.send('meeting-capture:fault', payload)
});
