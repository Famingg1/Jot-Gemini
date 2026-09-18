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
let meeting = null;
let largeHud = false;
let meetingDurationMs = 0;
let startedAt = 0;
let timerHandle;
let readyTimer;

const labels = {
  starting:'Microfoon voorbereiden…',preparing:'Opname voorbereiden…',finalizing:'Audio opslaan…',recording: 'Meetingopname', paused: 'Gepauzeerd', idle: 'Dicteren', listening: '', locked: 'Handsfree', processing: 'Transcriberen…',
  inserting: 'Invoegen…', success: 'Klaar', clipboard: 'Gekopieerd naar klembord',
  offline: 'Opname bewaard — wacht op verbinding', error: 'Opname bewaard in Geschiedenis', secure: 'Beveiligd veld — dictatie gepauzeerd', cancelled: 'Geannuleerd'
};

function render(next) {
  const previousState=state;clearTimeout(readyTimer);
  const previousMeetingId = meeting?.id || meeting?.meetingId;
  state = next.state;
  if (next.mode === 'meeting' || next.meetingId || ['recording','paused'].includes(next.state)) meeting = next; else meeting = null;
  if (meeting && (meeting.id || meeting.meetingId) !== previousMeetingId) meetingDurationMs = Number.isFinite(next.durationMs) ? next.durationMs : 0;
  pill.setAttribute('aria-label', meeting ? 'TakkieAI meetingopname' : 'TakkieAI dictatie');
  pill.title = meeting ? `${next.state === 'preparing'?'Opname wordt voorbereid':next.state === 'paused' ? 'Opname gepauzeerd' : 'Meeting wordt opgenomen'} \u00b7 Microfoon ${next.mic === false ? 'uit' : 'aan'} \u00b7 Computer ${next.system === false ? 'uit' : 'aan'}` : (labels[next.state] || 'TakkieAI');
  cancelButton.setAttribute('aria-label', meeting ? (next.state === 'paused' ? 'Opname hervatten' : 'Opname pauzeren') : 'Dictatie annuleren');
  cancelButton.title = cancelButton.getAttribute('aria-label');
  pill.className = `pill ${state}${largeHud ? ' large' : ''}`;
  message.textContent = next.message || labels[state] || 'TakkieAI';
  if(next.ready||(state==='recording'&&previousState==='preparing')){pill.classList.add('ready');message.textContent='Spreek nu';readyTimer=setTimeout(()=>{pill.classList.remove('ready');message.textContent=labels[state]||'';},1100);}
  leading.textContent = state === 'success' ? '✓' : state === 'clipboard' ? '⧉' : state === 'secure' ? '◆' : ['offline', 'error'].includes(state) ? '!' : '●';
  const active = ['listening','locked','recording','paused'].includes(state);
  timer.hidden = !active;
  pasteButton.hidden = state !== 'clipboard';
  clearInterval(timerHandle);
  if (active) {
    if (!startedAt) startedAt = Date.now();
    tick(); timerHandle = setInterval(tick, 250);
  } else startedAt = 0;
}

function tick() {
  const seconds = Math.floor((meeting ? meetingDurationMs : Date.now() - startedAt) / 1000);
  timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

let drag = null;
let suppressClick = false;
pill.addEventListener('pointerdown', event => {
  if (event.button !== 0 || (event.target.closest('button') && !idleHit.contains(event.target))) return;
  suppressClick = false;
  drag = { id: event.pointerId, x: event.screenX, y: event.screenY, clientX: event.clientX, clientY: event.clientY, moved: false };
  (idleHit.contains(event.target) ? idleHit : pill).setPointerCapture(event.pointerId);
  window.jot.hudDrag('start');
});
pill.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  if (Math.hypot(event.screenX - drag.x, event.screenY - drag.y) > 5 || Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) > 5) drag.moved = true;
  if (drag.moved) { pill.classList.add('dragging'); window.jot.hudDrag('move'); }
});
function finishDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  suppressClick = drag.moved;
  drag = null;
  pill.classList.remove('dragging');
  window.jot.hudDrag('end');
}
pill.addEventListener('pointerup', finishDrag);
pill.addEventListener('pointercancel', finishDrag);
pill.addEventListener('lostpointercapture', finishDrag);
pill.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
idleHit.addEventListener('click', () => window.jot.hudStart());
document.getElementById('note-hit').addEventListener('click', () => window.jot.hudNote().catch(error=>{pill.title=error.message;}));
finishButton.addEventListener('click', () => meeting ? window.jot.stopMeeting(meeting.id || meeting.meetingId) : window.jot.hudStop());
cancelButton.addEventListener('click', () => meeting ? (state === 'paused' ? window.jot.resumeMeeting() : window.jot.pauseMeeting()) : window.jot.cancelDictation());
pasteButton.addEventListener('click', () => window.jot.pasteLast());

window.jot.onHudState(render);
let targetLevel=0,shownLevel=0,lastLevelAt=0;
window.jot.onHudLevel(level=>{targetLevel=Math.max(0,Math.min(1,Number(level)||0));lastLevelAt=performance.now();});
let lastFrame=performance.now();
function animateWave(now){const active=['listening','locked','recording'].includes(state);const target=active&&now-lastLevelAt<700?targetLevel:0;const dt=Math.min(100,now-lastFrame);lastFrame=now;shownLevel+=(target-shownLevel)*(1-Math.exp(-dt/(target>shownLevel?35:140)));window.TakkieWave.shape(shownLevel,bars.length).forEach((value,index)=>bars[index].style.setProperty('--level',value.toFixed(3)));requestAnimationFrame(animateWave);}
requestAnimationFrame(animateWave);

render({ state: 'idle' });

if (window.jot.hudInteractive) {
  pill.addEventListener('mouseenter', () => window.jot.hudInteractive(true));
  pill.addEventListener('mouseleave', () => window.jot.hudInteractive(false));
  document.body.addEventListener('mousemove', event => window.jot.hudInteractive(pill.contains(event.target)));
}

function applyHudSettings(settings) { document.getElementById('note-hit').title='Notetaker · '+window.TakkieHotkeys.label(window.TakkieHotkeys.notesFromSettings(settings||{})[0]); largeHud = Boolean(settings?.largeHud); pill.classList.toggle('large', largeHud); document.body.dataset.dock = settings?.hudPosition || 'center'; }
window.jot.bootstrap().then(value => applyHudSettings(value.settings)).catch(() => {});
window.jot.onSettingsChanged?.(applyHudSettings);
window.jot.onMeetingLevels?.(value => { if (Number.isFinite(value.durationMs)) meetingDurationMs = value.durationMs; if (meeting) tick(); });
