'use strict';
const path = require('node:path');
const { BrowserWindow, ipcMain } = require('electron');

function createMeetingPanel({ manager, meetings, hardenWebContents }) {
  let window = null;
  let meetingId = null;
  let closing = false;
  const refresh = () => { if (window && !window.isDestroyed()) window.webContents.send('meeting-panel:changed'); };
  manager.on('changed', refresh);
  manager.on('levels', value => { if (value.id === meetingId && window && !window.isDestroyed()) window.webContents.send('meeting-panel:levels', value); });
  ipcMain.handle('meeting-panel:action', async (event, action, value) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== event.sender.mainFrame) throw Error('Deze actie is niet toegestaan.');
    if (action === 'get') return meetings.get(meetingId);
    if (action === 'notes') { const result = meetings.update(meetingId, { notes: value }); manager.emit('changed'); return result.notes; }
    if (action === 'hide') { window.hide(); return; }
    if (action === 'retry') return manager.retry(meetingId);
    if (manager.active?.id !== meetingId) throw Error('Deze meeting neemt niet meer op.');
    if (action === 'pause') return manager.pause();
    if (action === 'resume') return manager.resume();
    if (action === 'stop') return manager.stop();
    throw Error('Onbekende actie.');
  });
  return {
    get window() { return window; },
    async open(id) {
      meetings.meta(id);
      // One panel per session; save notes before switching its document.
      if (window && !window.isDestroyed() && meetingId !== id) await window.webContents.executeJavaScript('window.flushMeetingNotes?.()');
      meetingId = id;
      if (!window || window.isDestroyed()) {
        window = new BrowserWindow({ width: 560, height: 760, minWidth: 375, minHeight: 500, show: false, title: 'Meeting · TakkieAI', backgroundColor: '#ffffff', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, '..', 'meeting-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
        hardenWebContents(window.webContents);
        window.on('close', event => { if (!closing) { event.preventDefault(); window.webContents.send('meeting-panel:close'); } });
        await window.loadFile(path.join(__dirname, '..', 'renderer', 'meeting.html'));
      } else refresh();
      window.show(); window.focus();
    },
    async dispose() { closing = true; manager.removeListener('changed', refresh); if (window && !window.isDestroyed()) { await window.webContents.executeJavaScript('window.flushMeetingNotes?.()').catch(() => {}); window.destroy(); } ipcMain.removeHandler('meeting-panel:action'); }
  };
}
module.exports = { createMeetingPanel };
