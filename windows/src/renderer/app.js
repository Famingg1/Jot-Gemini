'use strict';

const pageMeta = {
  history: ['Geschiedenis', 'Alles wat je hebt gedicteerd, lokaal bewaard.'],
  dictionary: ['Woordenboek', 'Leer TakkieAI hoe jouw namen en vaktermen geschreven worden.'],
  general: ['Algemeen', 'Sneltoets, opstartgedrag en uiterlijk.'],
  dictation: ['Dictatie', 'Bepaal hoe TakkieAI luistert en je tekst afwerkt.'],
  privacy: ['Privacy', 'Jouw sleutel, opnames en bewaartermijn.'],
  advanced: ['Geavanceerd', 'Modelkeuze en technische informatie.'],
  about: ['Over TakkieAI', 'Een open-source dicteerapp met Gemini.']
};

const state = { settings: null, history: [], stats: {}, versions: {}, section: 'history', dictation: 'idle' };
const byId = (id) => document.getElementById(id);

const recorder = new window.TakkieAudioRecorder();

function navigate(section) {
  if (window.flowNavigate?.(section)) return;
  if (!pageMeta[section]) return;
  state.section = section;
  document.querySelectorAll('.nav-item').forEach((item) => {
    const active = item.dataset.section === section;
    item.classList.toggle('is-active', active);
    if (active && window.innerWidth <= 800) item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
  document.querySelectorAll('.page-section').forEach((item) => item.classList.toggle('is-active', item.id === `section-${section}`));
  byId('page-title').textContent = pageMeta[section][0];
  byId('page-subtitle').textContent = pageMeta[section][1];
  if (section === 'history') refreshHistory();
}

function hotkeyLabel(value) {
  if (state.settings?.hotkeys?.length) return window.TakkieHotkeys.label(state.settings.hotkeys[0]);
  return { 'right-control': 'Rechter Ctrl', 'caps-lock': 'Caps Lock', f8: 'F8' }[value] || 'Rechter Ctrl';
}

async function updateSettings(patch) {
  state.settings = await window.jot.updateSettings(patch);
  syncControls();
}

function syncControls() {
  const settings = state.settings;
  window.flowTheme?.(settings.theme);
  window.renderHotkeys?.(settings);
  byId('launch-toggle').checked = settings.launchAtLogin;
  byId('theme-select').value = settings.theme;
  byId('smart-toggle').checked = settings.smartTranscription;
  byId('language-select').value = settings.language;
  byId('sounds-toggle').checked = settings.sounds;
  byId('hud-position').value = settings.hudPosition || 'center';
  byId('retention-select').value = String(settings.audioRetentionDays);
  byId('model-input').value = settings.model;
  byId('microphone-select').value = settings.microphoneId;
  byId('hotkey-hint').textContent = hotkeyLabel(settings.hotkey);
  byId('onboarding-hotkey').textContent = hotkeyLabel(settings.hotkey).toLocaleLowerCase();
  byId('api-key-status').textContent = settings.hasApiKey ? 'Veilig versleuteld opgeslagen voor dit Windows-account.' : 'Nog geen sleutel opgeslagen.';
  byId('api-key-clear').hidden = !settings.hasApiKey;
  renderDictionary();
}

async function loadMicrophones() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === 'audioinput');
    const select = byId('microphone-select');
    select.replaceChildren(new Option('Systeemstandaard', 'default'));
    for (const device of inputs) select.add(new Option(device.label || `Microfoon ${select.options.length}`, device.deviceId));
    select.value = state.settings.microphoneId;
    if (select.selectedIndex < 0) select.value = 'default';
  } catch (error) {
    byId('microphone-help').textContent = `Microfoons konden niet worden gelezen: ${error.message}`;
  }
}

function renderDictionary() {
  const terms = state.settings.dictionary || [];
  const target = byId('dictionary-list');
  target.replaceChildren();
  if (!terms.length) {
    const message = document.createElement('p');
    message.textContent = 'Nog geen eigen woorden. Voeg bijvoorbeeld klantnamen, producten of afkortingen toe.';
    target.append(message);
  } else {
    terms.forEach((term, index) => {
      const token = document.createElement('span');
      token.className = 'token';
      token.append(document.createTextNode(term));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `${term} verwijderen`);
      remove.textContent = '×';
      remove.addEventListener('click', () => updateSettings({ dictionary: terms.filter((_, itemIndex) => itemIndex !== index) }));
      token.append(remove);
      target.append(token);
    });
  }

  const replacementTarget = byId('replacement-list');
  replacementTarget.replaceChildren();
  for (const [index, replacement] of (state.settings.replacements || []).entries()) {
    const row = document.createElement('div');
    row.className = 'replacement-row';
    const from = document.createElement('code'); from.textContent = replacement.from;
    const arrow = document.createElement('span'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
    const to = document.createElement('code'); to.textContent = replacement.to;
    const remove = document.createElement('button'); remove.className = 'icon-button'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Vervangregel ${replacement.from} verwijderen`);
    remove.addEventListener('click', () => updateSettings({ replacements: state.settings.replacements.filter((_, itemIndex) => itemIndex !== index) }));
    row.append(from, arrow, to, remove);
    replacementTarget.append(row);
  }
}

async function refreshHistory(query = byId('history-search').value) {
  const result = await window.jot.listHistory(query);
  state.history = result.records;
  state.stats = result.stats;
  byId('stat-words').textContent = result.stats.words.toLocaleString('nl-NL');
  byId('stat-dictations').textContent = result.stats.dictations.toLocaleString('nl-NL');
  byId('stat-wpm').textContent = result.stats.averageWpm || '—';
  renderHistory();
}

function renderHistory() {
  const target = byId('history-list');
  target.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    const inner = document.createElement('div'); inner.className = 'empty-state-inner';
    const wave = document.createElement('div'); wave.className = 'empty-wave'; wave.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 5; index += 1) wave.append(document.createElement('i'));
    const heading = document.createElement('h2'); heading.textContent = byId('history-search').value ? 'Geen dictaten gevonden' : 'Je woorden verschijnen hier';
    const copy = document.createElement('p'); copy.textContent = byId('history-search').value ? 'Probeer een andere zoekterm.' : `Houd ${hotkeyLabel(state.settings.hotkey).toLocaleLowerCase()} ingedrukt en begin te praten. Ook mislukte opnames blijven herstelbaar.`;
    inner.append(wave, heading, copy); empty.append(inner); target.append(empty); return;
  }

  let currentDay = '';
  for (const record of state.history) {
    const date = new Date(record.startedAt);
    const day = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'full' }).format(date);
    if (day !== currentDay) {
      currentDay = day;
      const heading = document.createElement('h2'); heading.className = 'day-heading'; heading.textContent = day;
      target.append(heading);
    }
    const row = document.createElement('button'); row.type = 'button'; row.className = 'history-row';
    const body = document.createElement('div');
    const transcript = document.createElement('p'); transcript.textContent = record.finalTranscript || record.rawTranscript || record.errorMessage || 'Opname heeft aandacht nodig';
    const meta = document.createElement('span'); meta.className = 'history-meta';
    const time = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(date);
    meta.textContent = [record.targetApp, time, record.durationSeconds ? `${Math.round(record.durationSeconds)} sec` : ''].filter(Boolean).join(' · ');
    body.append(transcript, meta);
    const status = document.createElement('span'); status.className = 'history-status';
    status.textContent = statusLabel(record.status);
    if (['failed', 'queuedForRetry', 'cancelled'].includes(record.status)) status.classList.add('needs-attention');
    row.append(body, status);
    row.addEventListener('click', () => openRecord(record));
    target.append(row);
  }
}

function statusLabel(status) {
  return { complete: 'Klaar', failed: 'Mislukt', queuedForRetry: 'Wacht op netwerk', cancelled: 'Geannuleerd', silent: 'Geen spraak', transcribing: 'Bezig' }[status] || status;
}

function openRecord(record) {
  const target = byId('history-dialog-content');
  target.replaceChildren();
  const title = document.createElement('h2'); title.textContent = record.targetApp ? `Dictaat in ${record.targetApp}` : 'Dictaat';
  const meta = document.createElement('p'); meta.textContent = `${new Date(record.startedAt).toLocaleString('nl-NL')} · ${Math.round(record.durationSeconds || 0)} seconden`;
  const transcript = document.createElement('div'); transcript.className = 'transcript-block'; transcript.textContent = record.finalTranscript || record.rawTranscript || record.errorMessage || 'Geen transcript beschikbaar.';
  const actions = document.createElement('div'); actions.className = 'dialog-actions';
  if (record.finalTranscript || record.rawTranscript) actions.append(actionButton('Kopiëren', 'secondary-button', async () => { await window.jot.copyHistory(record.finalTranscript || record.rawTranscript); toast('Transcript gekopieerd.'); }));
  if (record.audioAvailable) actions.append(actionButton('Audio openen', 'secondary-button', async () => { const error = await window.jot.openAudio(record.id); if (error) toast(error); }));
  actions.append(actionButton('Exporteren', 'secondary-button', () => window.jot.exportHistory(record.id)));
  if (record.audioAvailable && ['failed', 'queuedForRetry'].includes(record.status)) actions.append(actionButton('Opnieuw proberen', 'primary-button', async (button) => { button.disabled = true; await window.jot.retryHistory(record.id); byId('history-dialog').close(); }));
  actions.append(actionButton('Verwijderen', 'secondary-button danger-button', async () => {
    if (!confirm('Dit dictaat en de bijbehorende audio definitief verwijderen?')) return;
    await window.jot.deleteHistory(record.id); byId('history-dialog').close(); await refreshHistory();
  }));
  target.append(title, meta, transcript, actions);
  byId('history-dialog').showModal();
}

function actionButton(label, className, handler) {
  const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label;
  button.addEventListener('click', () => Promise.resolve(handler(button)).catch((error) => toast(error.message)));
  return button;
}

function updateDictationState(next) {
  state.dictation = next.state;
  const labels = { idle: 'Klaar', starting:'Microfoon voorbereiden…', listening: 'Luisteren…', locked: 'Handsfree luisteren…', processing: 'Transcriberen…', inserting: 'Invoegen…', success: 'Ingevoegd', clipboard: 'Gekopieerd', offline: 'Wacht op netwerk', error: 'Aandacht nodig', secure: 'Beveiligd veld', cancelled: 'Geannuleerd' };
  byId('sidebar-status-text').textContent = labels[next.state] || 'Klaar';
  byId('status-dot').dataset.state = next.state;
  byId('start-button').disabled = ['processing', 'inserting'].includes(next.state);
  byId('start-button').textContent = ['starting','listening', 'locked'].includes(next.state) ? 'Stop dictatie' : 'Start dictatie';
  if (next.state === 'idle') {
    if (state.settings.showIdleIndicator) window.jot.showHud(); else window.jot.hideHud();
  } else {
    window.jot.showHud();
  }
  if (next.message && ['error', 'offline', 'clipboard', 'secure'].includes(next.state)) toast(next.message);
  playStateSound(next.ready?'listening':next.state);
}

function playStateSound(name) {
  if (!state.settings?.sounds || !['listening', 'success', 'error'].includes(name)) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(name === 'error' ? 185 : name === 'success' ? 784 : 587, now);
  if (name === 'listening') oscillator.frequency.exponentialRampToValueAtTime(784, now + .11);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.025, now + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .16);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now); oscillator.stop(now + .18);
  oscillator.onended = () => context.close();
}

function toast(message) {
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = message;
  byId('toast-region').append(item);
  setTimeout(() => item.remove(), 4200);
}

function showNotice(message, isError = false) {
  const settingsDialog = byId('settings-dialog');
  if (settingsDialog?.open) {
    let messageBox = settingsDialog.querySelector('.inline-error');
    if (!messageBox) { messageBox = document.createElement('p'); messageBox.className = 'inline-error notice'; messageBox.setAttribute('role', 'status'); settingsDialog.querySelector('.settings-body').append(messageBox); }
    messageBox.classList.toggle('is-error', isError); messageBox.textContent = message;
    return;
  }
  const notice = byId('notice'); notice.textContent = message; notice.hidden = false; notice.classList.toggle('is-error', isError);
  setTimeout(() => { notice.hidden = true; }, 6000);
}

let onboardingStep = 0;
function setOnboardingStep(index) {
  onboardingStep = Math.max(0, Math.min(3, index));
  document.querySelectorAll('.onboarding-step').forEach((step) => step.classList.toggle('is-active', Number(step.dataset.step) === onboardingStep));
  document.querySelectorAll('.onboarding-progress i').forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === onboardingStep));
}

async function finishOnboarding() {
  await recorder.stop();
  await updateSettings({ onboardingComplete: true });
  byId('onboarding').hidden = true;
  if (state.settings.showIdleIndicator) window.jot.showHud();
  toast(`TakkieAI staat klaar. Houd ${hotkeyLabel(state.settings.hotkey).toLocaleLowerCase()} ingedrukt om te praten.`);
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => navigate(item.dataset.section)));
  window.jot.onNavigate(navigate);
  window.jot.onState(updateDictationState);
  window.jot.onHistoryChanged(() => refreshHistory());
  window.jot.onDiagnostic((message) => showNotice(message, true));
  let audioCommands=Promise.resolve();
  const cancelledStarts=new Set();
  window.jot.onAudioCommand(command => {
    if(command.action==='stop'){cancelledStarts.add(command.id);recorder.abortStart();}
    audioCommands=audioCommands.catch(()=>{}).then(async()=>{
    if (command.action === 'start') {
      if(cancelledStarts.has(command.id))return;
      try { await recorder.start({ deviceId: command.microphoneId, capture: true,sessionId:command.id }); }
      catch (error) { await recorder.stop().catch(()=>{});showNotice(`Microfoon kon niet starten: ${error.message}`,true);window.jot.audioStatus(command.id,'error'); }
    } else if (command.action === 'stop') {try{await recorder.stop();window.jot.audioStatus(command.id,'stopped');}catch{window.jot.audioStatus(command.id,'stop-error');}finally{cancelledStarts.delete(command.id);}}
    });
  });

  byId('start-button').addEventListener('click', () => ['starting','listening', 'locked'].includes(state.dictation) ? window.jot.stopDictation() : window.jot.startDictation());
  byId('history-search').addEventListener('input', debounce(() => refreshHistory(), 180));
  byId('dictionary-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const input = byId('dictionary-term'); const term = input.value.trim();
    if (!term) return; if (state.settings.dictionary.some((item) => item.toLocaleLowerCase() === term.toLocaleLowerCase())) return toast('Dit woord staat al in je woordenboek.');
    await updateSettings({ dictionary: [...state.settings.dictionary, term] }); input.value = '';
  });
  byId('replacement-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const from = byId('replacement-from').value.trim(); const to = byId('replacement-to').value.trim();
    if (!from || !to) return; await updateSettings({ replacements: [...state.settings.replacements, { from, to }] });
    byId('replacement-from').value = ''; byId('replacement-to').value = '';
  });

  const settingBindings = [
    ['launch-toggle', 'change', () => ({ launchAtLogin: byId('launch-toggle').checked })],
    ['theme-select', 'change', () => ({ theme: byId('theme-select').value })],
    ['smart-toggle', 'change', () => ({ smartTranscription: byId('smart-toggle').checked })],
    ['language-select', 'change', () => ({ language: byId('language-select').value })],
    ['microphone-select', 'change', () => ({ microphoneId: byId('microphone-select').value })],
    ['sounds-toggle', 'change', () => ({ sounds: byId('sounds-toggle').checked })],
    ['hud-position', 'change', () => ({ hudPosition: byId('hud-position').value })],
    ['retention-select', 'change', () => ({ audioRetentionDays: Number(byId('retention-select').value) })],
    ['model-input', 'change', () => ({ model: byId('model-input').value.trim() || 'gemini-3.5-transcribe' })]
  ];
  settingBindings.forEach(([id, event, value]) => byId(id).addEventListener(event, () => updateSettings(value())));

  byId('api-key-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const button = event.submitter; button.disabled = true; button.textContent = 'Controleren…';
    const result = await window.jot.saveApiKey(byId('api-key-input').value);
    button.disabled = false; button.textContent = 'Controleren en opslaan';
    if (result.ok) { state.settings.hasApiKey = true; byId('api-key-input').value = ''; syncControls(); showNotice('API-key gecontroleerd en versleuteld opgeslagen.'); }
    else showNotice(result.message, true);
  });
  byId('api-key-clear').addEventListener('click', async () => { await window.jot.clearApiKey(); state.settings.hasApiKey = false; syncControls(); });
  document.querySelectorAll('.external-link').forEach((button) => button.addEventListener('click', () => window.jot.openExternal(button.dataset.url)));
  byId('history-dialog').querySelector('.dialog-close').addEventListener('click', () => byId('history-dialog').close());
  byId('history-dialog').addEventListener('click', (event) => { if (event.target === byId('history-dialog')) byId('history-dialog').close(); });

  document.querySelectorAll('.onboarding-next').forEach((button) => button.addEventListener('click', () => setOnboardingStep(onboardingStep + 1)));
  byId('onboarding-close').addEventListener('click', finishOnboarding);
  byId('privacy-explainer').addEventListener('click', () => toast('Audio gaat naar Gemini; geschiedenis en instellingen blijven op deze pc. Er zijn geen analytics of TakkieAI-servers.'));
  byId('onboarding-key-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const button = event.submitter; const resultText = byId('onboarding-key-result'); button.disabled = true; button.textContent = 'Controleren…';
    const result = await window.jot.saveApiKey(byId('onboarding-key').value); button.disabled = false; button.textContent = 'Controleren';
    resultText.textContent = result.ok ? 'Sleutel werkt en is veilig opgeslagen.' : result.message; resultText.className = `form-result ${result.ok ? 'is-success' : 'is-error'}`;
    if (result.ok) { state.settings.hasApiKey = true; setTimeout(() => setOnboardingStep(2), 550); }
  });
  byId('test-microphone').addEventListener('click', async () => {
    const button = byId('test-microphone'); const result = byId('microphone-result'); button.disabled = true;
    try {
      await recorder.start({ capture: false, levelHandler: (level) => { byId('onboarding-meter').style.transform = `scaleX(${Math.max(.02, level)})`; if (level > .2) result.textContent = 'We horen je — microfoon werkt.'; } });
      result.textContent = 'Zeg iets…'; result.className = 'form-result'; await loadMicrophones();
      setTimeout(async () => { await recorder.stop(); button.disabled = false; button.textContent = 'Nogmaals testen'; }, 4500);
    } catch (error) { button.disabled = false; result.textContent = 'Geen microfoontoegang. Controleer Windows Instellingen › Privacy en beveiliging › Microfoon.'; result.className = 'form-result is-error'; }
  });
  byId('finish-onboarding').addEventListener('click', finishOnboarding);
  document.addEventListener('keydown', (event) => {
    if (event.key === ',' && event.ctrlKey) { event.preventDefault(); navigate('general'); }
    if (event.key === 'Escape' && byId('history-dialog').open) byId('history-dialog').close();
  });
}

function debounce(callback, wait) {
  let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => callback(...args), wait); };
}

async function initialize() {
  bindEvents();
  const bootstrap = await window.jot.bootstrap();
  Object.assign(state, bootstrap);
  syncControls();
  renderHistory();
  await window.flowInitialize?.();
  await loadMicrophones();
  byId('diagnostics').textContent = `TakkieAI ${bootstrap.versions.app}\nElectron ${bootstrap.versions.electron}\nWindows ${navigator.userAgent.match(/Windows NT [^;)]+/)?.[0] || 'Windows'}\nModel ${state.settings.model}\nAPI-key ${state.settings.hasApiKey ? 'opgeslagen' : 'niet ingesteld'}`;
  byId('version-label').textContent = `Versie ${bootstrap.versions.app}`;
  byId('onboarding').hidden = bootstrap.settings.onboardingComplete;
  if (!bootstrap.settings.onboardingComplete) setOnboardingStep(0);
  else if (bootstrap.settings.showIdleIndicator) window.jot.showHud();
  byId('app').setAttribute('aria-busy', 'false');
}

initialize().catch((error) => {
  document.body.textContent = `TakkieAI kon niet starten: ${error.message}`;
});
