'use strict';

const pill = document.getElementById('pill');
const leading = document.getElementById('leading');
const message = document.getElementById('message');
const timer = document.getElementById('timer');
const cancelButton = document.getElementById('cancel');
const finishButton = document.getElementById('finish');
const pasteButton = document.getElementById('paste');
const idleHit = document.getElementById('idle-hit');
const bars = [...document.querySelectorAll('.wave i')];
let state = 'idle';
let startedAt = 0;
let timerHandle;

const labels = {
  idle: 'Dicteren', listening: 'Luisteren…', locked: 'Handsfree', processing: 'Transcriberen…',
  inserting: 'Invoegen…', success: 'Klaar', clipboard: 'Gekopieerd naar klembord',
  offline: 'Opname bewaard — wacht op verbinding', error: 'Opname bewaard in Geschiedenis', secure: 'Beveiligd veld — dictatie gepauzeerd', cancelled: 'Geannuleerd'
};

function render(next) {
  state = next.state;
  pill.className = `pill ${state}`;
  message.textContent = next.message || labels[state] || 'Jot';
  leading.textContent = state === 'success' ? '✓' : state === 'clipboard' ? '⧉' : state === 'secure' ? '◆' : ['offline', 'error'].includes(state) ? '!' : '●';
  const active = state === 'listening' || state === 'locked';
  timer.hidden = !active;
  pasteButton.hidden = state !== 'clipboard';
  clearInterval(timerHandle);
  if (active) {
    if (!startedAt) startedAt = Date.now();
    tick(); timerHandle = setInterval(tick, 250);
  } else startedAt = 0;
}

function tick() {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

idleHit.addEventListener('click', () => window.jot.hudStart());
finishButton.addEventListener('click', () => window.jot.hudStop());
cancelButton.addEventListener('click', () => window.jot.cancelDictation());
pasteButton.addEventListener('click', () => window.jot.pasteLast());

window.jot.onHudState(render);
window.jot.onHudLevel((level) => {
  bars.forEach((bar, index) => {
    const shaped = Math.max(.22, Math.min(1, level * (1.35 - Math.abs(index - 2) * .12)));
    bar.style.setProperty('--level', shaped.toFixed(2));
  });
});

render({ state: 'idle' });
