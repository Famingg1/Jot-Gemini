'use strict';

// Install during normal graceful quit, never when the main window just hides.
let status = 'Updates automatisch controleren';
let checkNow = async () => {};
let readyVersion = '';
let installNow = () => false;
function startUpdates({ updater, onStatus = () => {}, onEvent = () => {} }) {
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  readyVersion = '';
  let checking = false;
  const set = value => { status = value; onStatus(); };
  updater.on('checking-for-update', () => set('Controleren op updates…'));
  updater.on('update-available', info => { set('Update wordt gedownload…'); onEvent('update-available', info?.version); });
  updater.on('update-not-available', () => set('TakkieAI is bijgewerkt'));
  updater.on('update-downloaded', info => { readyVersion = info?.version || 'nieuw'; set(`Versie ${readyVersion} klaar — start opnieuw op om bij te werken`); onEvent('update-downloaded', readyVersion); });
  // Only on an explicit click: the installer starts and the app quits normally, so a running meeting is finalized first.
  installNow = () => { if (!readyVersion) return false; updater.quitAndInstall(true, true); return true; };
  updater.on('error', error => { set('Updatecontrole niet gelukt — probeer later opnieuw'); onEvent('error', error?.message); });
  checkNow = async () => {
    if (checking) return;
    checking = true;
    try { await updater.checkForUpdates(); }
    catch { set('Updatecontrole niet gelukt — probeer later opnieuw'); }
    finally { checking = false; }
  };
  const initial = setTimeout(checkNow, 15000);
  const periodic = setInterval(checkNow, 60 * 60 * 1000);
  initial.unref?.(); periodic.unref?.();
  return () => { clearTimeout(initial); clearInterval(periodic); };
}
module.exports = { startUpdates, updateStatus: () => status, checkUpdates: () => checkNow(), updateState: () => ({ status, readyVersion }), installUpdate: () => installNow() };
