/* global meetingCapture */
'use strict';
let active = null;
async function release() { const a = active; active = null; if (!a) return; for (const stream of a.streams) for (const track of stream.getTracks()) track.stop(); try { a.node?.disconnect(); await a.context?.close(); } catch { /* already closed */ } }
function fail(error, a = active) { if (!a || active !== a || a.failed) return; a.failed = true; meetingCapture.fault({ id: a.id, message: String(error.message || error) }); release().catch(() => {}); }
async function start(command) {
  if (active) throw new Error('Capture is already active.');
  const a = { id: command.id, streams: [], pending: new Set(), flushes: new Map(), failed: false }; active = a;
  const enabled = [command.mic !== false, command.system !== false];
  const streams = [null,null];
  if (enabled[0]) { try { streams[0] = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: command.microphoneId && command.microphoneId !== 'default' ? { exact: command.microphoneId } : undefined, echoCancellation: true, noiseSuppression: true }, video: false }); a.streams.push(streams[0]); } catch(error) { throw captureSources.sourceError('mic',error); } }
  if (enabled[1] && !command.nativeSystem) { try { streams[1] = await captureSources.systemAudio(options=>navigator.mediaDevices.getDisplayMedia(options)); a.streams.push(streams[1]); if (!streams[1].getAudioTracks().length) throw new Error('Geen systeemgeluid ontvangen.'); } catch(error) { throw captureSources.sourceError('system',error); } }
  a.context = new AudioContext({ sampleRate: 16000 });
  await a.context.audioWorklet.addModule('audio-worklet.js');
  a.node = new AudioWorkletNode(a.context, 'meeting-pcm', { numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { sources: enabled,nativeSystem:command.nativeSystem,nativeLatency:command.nativeLatency } });
  a.node.onprocessorerror = () => fail(new Error('Audioverwerking onderbroken.'), a);
  a.node.port.onmessage = event => {
    if (active !== a) return; const payload = event.data;
    if(payload.type==='fault')return fail(new Error(payload.message),a);
    if (payload.type === 'chunk') {
      if (a.pending.size >= 12) return fail(new Error('Opslag te traag; opname veilig gestopt.'), a);
      const promise = meetingCapture.chunk({ id: a.id, source: payload.source, sequence: payload.sequence, sampleOffset: payload.sampleOffset, pcm: new Uint8Array(payload.pcm) });
      a.pending.add(promise); promise.catch(error => fail(error, a)).finally(() => a.pending.delete(promise));
    } else if (payload.type === 'levels') meetingCapture.levels({ id: a.id, ...payload });
    else if (payload.type === 'flushed') { const resolve = a.flushes.get(payload.token); a.flushes.delete(payload.token); resolve?.(); }
  };
  streams.forEach((stream,n) => { if (!stream) return; a.context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(a.node, 0,n); for (const track of stream.getAudioTracks()) { track.onended = () => { if (active === a) fail(new Error(`${n === 0 ? 'Microfoon' : 'Systeemgeluid'} is losgekoppeld.`)); }; track.onmute = () => { if (active === a) meetingCapture.levels({ id: a.id, mic: 0, system: 0, interruptedSource: n === 0 ? 'mic' : 'system' }); }; } });
  // Output is silence; graph stays pulled without feeding recorded audio to speakers.
  a.node.connect(a.context.destination); await a.context.resume();
}
async function flush() {
  const a = active; if (!a) throw new Error('Capture is unavailable.');
  await a.context.suspend(); const token = crypto.randomUUID();
  await new Promise((resolve,reject) => { const timer = setTimeout(() => { a.flushes.delete(token); reject(new Error('Audio flush timeout.')); },10000); a.flushes.set(token, () => { clearTimeout(timer); resolve(); }); a.node.port.postMessage({ type: 'flush', token }); });
  await Promise.all([...a.pending]); if (a.failed) throw new Error('Audio opslag mislukt.');
}
let commands = Promise.resolve();
meetingCapture.onAppAudio(value=>{if(active?.id===value.id&&active.node){const pcm=new Uint8Array(value.pcm);active.node.port.postMessage({type:'native',pcm:pcm.buffer},[pcm.buffer]);}});
meetingCapture.onCommand(command => {
  commands = commands.then(async () => {
    try {
      if (command.type !== 'start' && active && active.id !== command.id) { meetingCapture.ack({ requestId: command.requestId, ok: false, error: 'Verouderde opnameactie genegeerd.' }); return; }
      if (command.type === 'start') await start(command);
      else if (command.type === 'pause') await flush();
      else if (command.type === 'resume') { if (!active) throw new Error('Geen opname.'); await active.context.resume(); }
      else if (command.type === 'stop') { await flush(); await release(); }
      else if (command.type === 'abort') await release();
      else throw new Error('Unknown capture command.');
      meetingCapture.ack({ requestId: command.requestId, ok: true });
    } catch (error) { await release(); meetingCapture.ack({ requestId: command.requestId, ok: false, error: error.message }); }
  });
});
