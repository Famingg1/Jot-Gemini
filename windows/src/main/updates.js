'use strict';

// Install during normal graceful quit, never when the main window just hides.
let status = 'Updates automatisch controleren';
let checkNow = async () => {};
function startUpdates({ updater, onStatus = () => {} }) {
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  let checking = false;
  const set = value => { status = value; onStatus(); };
  updater.on('checking-for-update', () => set('Controleren op updates…'));
  updater.on('update-available', () => set('Update wordt gedownload…'));
  updater.on('update-not-available', () => set('TakkieAI is bijgewerkt'));
  updater.on('update-downloaded', () => set('Update klaar — wordt bij afsluiten geïnstalleerd'));
  updater.on('error', () => set('Updatecontrole niet gelukt — probeer later opnieuw'));
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
module.exports = { startUpdates, updateStatus: () => status, checkUpdates: () => checkNow() };
