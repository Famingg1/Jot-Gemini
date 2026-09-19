(function (root) {
  'use strict';
  // Meeting audio is stored as 30 second WAV segments. This player presents them as one
  // continuous recording: a single transport, one timeline, seamless hand-over between files.
  function total(tracks) { return tracks.reduce((sum, track) => Math.max(sum, (track.offsetMs || 0) + (track.durationMs || 0)), 0); }
  function locate(tracks, ms) {
    if (!tracks.length) return null;
    const clamped = Math.max(0, Math.min(ms, Math.max(0, total(tracks) - 1)));
    const index = tracks.findIndex(track => clamped >= (track.offsetMs || 0) && clamped < (track.offsetMs || 0) + (track.durationMs || 0));
    const at = index >= 0 ? index : tracks.length - 1;
    return { index: at, track: tracks[at], withinMs: Math.max(0, clamped - (tracks[at].offsetMs || 0)) };
  }
  function clock(ms) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

  function create(container, { onError = () => {} } = {}) {
    const box = container.ownerDocument.createElement('div'); box.className = 'audio-player'; box.hidden = true;
    const toggle = container.ownerDocument.createElement('button'); toggle.type = 'button'; toggle.className = 'audio-toggle'; toggle.setAttribute('aria-label', 'Afspelen');
    const time = container.ownerDocument.createElement('span'); time.className = 'audio-time'; time.textContent = '0:00 / 0:00';
    const slider = container.ownerDocument.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '0'; slider.step = '250'; slider.value = '0'; slider.setAttribute('aria-label', 'Positie in de opname');
    const audio = container.ownerDocument.createElement('audio'); audio.preload = 'auto';
    box.append(toggle, time, slider, audio); container.append(box);
    let tracks = [], index = -1, dragging = false, wantPlay = false;
    const paint = () => { const current = index >= 0 ? (tracks[index].offsetMs || 0) + audio.currentTime * 1000 : 0; if (!dragging) slider.value = String(Math.round(current)); time.textContent = `${clock(current)} / ${clock(total(tracks))}`; toggle.textContent = audio.paused ? '▶' : '❙❙'; toggle.setAttribute('aria-label', audio.paused ? 'Afspelen' : 'Pauzeren'); };
    const open = (at, withinMs, autoplay) => new Promise(resolve => {
      const next = tracks[at]; if (!next) return resolve(false);
      const swap = index !== at || !audio.src.endsWith(next.url.replace(/^jot-audio:\/\//, ''));
      // A seek right after metadata can be dropped while the file is still buffering; reapply until it sticks.
      const apply = () => { audio.currentTime = withinMs / 1000; return Math.abs(audio.currentTime * 1000 - withinMs) < 300; };
      const place = () => { if (!apply()) { const retry = () => { if (apply()) { for (const type of ['canplay', 'progress', 'loadeddata']) audio.removeEventListener(type, retry); paint(); } }; for (const type of ['canplay', 'progress', 'loadeddata']) audio.addEventListener(type, retry); } paint(); if (autoplay) audio.play().catch(error => onError(error)); resolve(true); };
      index = at;
      if (swap) { audio.src = next.url; audio.addEventListener('loadedmetadata', place, { once: true }); audio.load(); } else place();
    });
    audio.addEventListener('timeupdate', paint); audio.addEventListener('play', paint); audio.addEventListener('pause', paint);
    audio.addEventListener('ended', () => { if (index + 1 < tracks.length) open(index + 1, 0, true); else { wantPlay = false; paint(); } });
    audio.addEventListener('error', () => onError(new Error('Dit deel van de opname kon niet worden afgespeeld.')));
    toggle.addEventListener('click', () => { if (audio.paused) { wantPlay = true; if (index < 0) open(0, 0, true); else audio.play().catch(onError); } else { wantPlay = false; audio.pause(); } });
    slider.addEventListener('pointerdown', () => { dragging = true; });
    slider.addEventListener('input', () => { time.textContent = `${clock(Number(slider.value))} / ${clock(total(tracks))}`; });
    slider.addEventListener('change', () => { dragging = false; api.seek(Number(slider.value)); });
    const api = {
      element: box,
      load(list) { tracks = (list || []).filter(item => item && item.url).sort((a, b) => (a.offsetMs || 0) - (b.offsetMs || 0)); index = -1; wantPlay = false; audio.pause(); audio.removeAttribute('src'); slider.max = String(Math.max(0, total(tracks))); slider.value = '0'; box.hidden = !tracks.length; paint(); return tracks.length; },
      seek(ms) { const target = locate(tracks, ms); if (!target) return false; return open(target.index, target.withinMs, wantPlay || !audio.paused); },
      play() { wantPlay = true; return index < 0 ? open(0, 0, true) : audio.play().catch(onError); },
      pause() { wantPlay = false; audio.pause(); },
      get loaded() { return tracks.length > 0; }
    };
    return api;
  }
  const api = { create, locate, total, clock };
  if (typeof module !== 'undefined') module.exports = api; else root.TakkiePlayer = api;
})(globalThis);
