'use strict';

// Pure decisions for the meeting hotkey (F9) and the HUD while a stopped meeting is still processing.

// What a press of the note hotkey should do given the current meeting state.
function noteHotkeyAction(meetingState) {
  if (['recording', 'paused'].includes(meetingState)) return 'stop';
  if (['preparing', 'finalizing'].includes(meetingState)) return 'ignore';
  return 'open';
}

// HUD payload for a transcriber progress event, or null when the HUD should not change.
function progressHudState(progress) {
  if (!progress || typeof progress !== 'object') return null;
  const steps = progress.total > 1 && Number.isFinite(progress.completed) ? ` (blok ${Math.min(progress.completed, progress.total)} van ${progress.total})` : '';
  switch (progress.state) {
    case 'transcribing': return { state: 'processing', mode: 'meeting', message: `Meeting transcriberen…${steps}`, holdMs: 0 };
    case 'summarizing': return { state: 'processing', mode: 'meeting', message: 'Samenvatting maken…', holdMs: 0 };
    case 'ready': return { state: 'success', mode: 'meeting', message: 'Meeting klaar', holdMs: 3000 };
    case 'saved': return progress.error ? { state: 'error', mode: 'meeting', message: 'Meeting bewaard, verwerken mislukt', holdMs: 6000 } : null;
    default: return null;
  }
}

module.exports = { noteHotkeyAction, progressHudState };
