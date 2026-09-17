'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app } = require('electron');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run({ mainWindow, hudWindow, services, storage, sessions, captureConsoleErrors }) {
  const root = path.resolve(process.env.JOT_CAPTURE_DIR || path.join(__dirname, '..', 'screenshots'));
  fs.mkdirSync(root, { recursive: true });
  const results = { startedAt: new Date().toISOString(), flows: {}, errors: [], profile: storage.root };
  const js = code => mainWindow.webContents.executeJavaScript(code, true);
  const shot = async (name, window = mainWindow) => { await sleep(250); fs.writeFileSync(path.join(root, `${name}.png`), (await window.webContents.capturePage()).toPNG()); };
  const navigate = async id => { await js(`window.flowNavigate(${JSON.stringify(id)})`); await sleep(250); };
  const click = async (selector, text) => { await js(`(() => { const candidates = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.offsetParent !== null); const el = ${text ? `candidates.find(e=>e.textContent.includes(${JSON.stringify(text)}))` : 'candidates[0]'}; if(!el) throw Error('Missing visible control: '+${JSON.stringify(text || selector)}); el.click(); })()`); await sleep(200); };
  if (process.env.JOT_PROCESS_CRASH) {
    const markerPath = path.join(root, 'process-crash-checkpoint.json');
    const digest = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    try {
      storage.updateSettings({ meetingAutoTranscribe: false });
      if (process.env.JOT_PROCESS_CRASH === 'prepare') {
        await sleep(500);
        const meeting = await js(`window.jot.startMeeting({title:'Process crash recovery verification',microphone:true,systemAudio:true})`);
        mainWindow.close();
        await sleep(4000);
        assert.ok(!mainWindow.isDestroyed() && !mainWindow.isVisible(), 'Closing the main window keeps capture alive');
        assert.ok(services.active());
        const tracks = {};
        for (const source of ['mic', 'system', 'mix']) {
          const pcm = fs.readFileSync(services.meetings.audioPath(meeting.id, source, 0)).subarray(44);
          assert.ok(pcm.length >= 3 * 16000 * 2);
          tracks[source] = { bytes: pcm.length, sha256: digest(pcm) };
        }
        fs.writeFileSync(markerPath, JSON.stringify({ id: meeting.id, pid: process.pid, tracks, mainWindowClosed: true }, null, 2));
        // The external test driver kills this exact isolated process tree. Do not run graceful disposal.
        await new Promise(() => {});
      } else {
        const checkpoint = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        const saved = services.meetings.get(checkpoint.id);
        assert.equal(saved.state, 'saved');
        assert.equal(saved.recovered, true);
        assert.equal(saved.error.code, 'interrupted');
        assert.equal(services.active(), false);
        const tracks = {};
        for (const [source, before] of Object.entries(checkpoint.tracks)) {
          const wav = fs.readFileSync(services.meetings.audioPath(saved.id, source, 0));
          assert.equal(wav.readUInt32LE(40), wav.length - 44, 'Recovered WAV header matches its PCM');
          assert.equal(digest(wav.subarray(44, 44 + before.bytes)), before.sha256, 'Acknowledged audio is unchanged');
          tracks[source] = { preservedBytes: before.bytes, recoveredBytes: wav.length - 44 };
        }
        mainWindow.show(); await navigate('notetaker');
        assert.ok(await js(`document.querySelector('#section-notetaker').textContent.includes('Process crash recovery verification')`));
        await shot('process-crash-recovered');
        results.flows.processCrashRecovery = { id: saved.id, durationMs: saved.durationMs, tracks, mainWindowClosed: checkpoint.mainWindowClosed };
        results.ok = true;
      }
    } catch (error) { results.ok = false; results.errors.push(error.stack || String(error)); process.exitCode = 1; }
    finally { results.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(root, 'process-crash.json'), JSON.stringify(results, null, 2)); }
    return;
  }
  if (process.env.JOT_SOAK) {
    const samples=[];const started=Date.now();const durationMs=3600000;
    try {
      storage.updateSettings({meetingAutoTranscribe:false});await sleep(500);
      const meeting=await js(`window.jot.startMeeting({title:'One-hour synthetic capture verification',microphone:true,systemAudio:true})`);
      mainWindow.hide();hudWindow.hide();
      while(Date.now()-started<durationMs) {
        await sleep(30000);
        const manifest=services.meetings.manifest(meeting.id);
        samples.push({elapsedMs:Date.now()-started,audioSamples:manifest.sources.mix?.samples||0,processes:app.getAppMetrics().map(p=>({type:p.type,pid:p.pid,workingSetKiB:p.memory.workingSetSize}))});
        assert.ok(services.active(),'Capture must remain active through the soak');
        fs.writeFileSync(path.join(root,'soak-progress.json'),JSON.stringify({startedAt:results.startedAt,id:meeting.id,samples,finished:false},null,2));
      }
      const saved=await js(`window.jot.stopMeeting()`);
      assert.ok(saved.durationMs>=3590000,'Capture must preserve at least59m50s');
      results.flows.oneHourSyntheticCapture={durationMs:saved.durationMs,samples,uploaded:false,physicalMicrophone:false};results.ok=true;
    }catch(error){results.ok=false;results.errors.push(error.stack||String(error));process.exitCode=1;}
    finally{results.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'soak.json'),JSON.stringify(results,null,2));}
    return;
  }
  if (process.env.JOT_SYSTEM_TEST) {
    try {
      storage.updateSettings({ meetingAutoTranscribe: false });
      await sleep(500);
      await js(`window.testToneContext=new AudioContext();window.testTone=window.testToneContext.createOscillator();window.testTone.frequency.value=440;window.testGain=window.testToneContext.createGain();window.testGain.gain.value=0.025;window.testTone.connect(window.testGain).connect(window.testToneContext.destination);window.testTone.start();window.testToneContext.resume();`);
      await js(`window.jot.startMeeting({title:'Local Windows loopback verification',microphone:false,systemAudio:true})`);
      await sleep(3000);
      const saved=await js(`window.jot.stopMeeting()`);
      const pcm=fs.readFileSync(services.meetings.audioPath(saved.id,'system',0)).subarray(44);
      let energy=0;for(let n=0;n<pcm.length;n+=2)energy+=pcm.readInt16LE(n)**2;
      const rms=Math.sqrt(energy/(pcm.length/2));
      assert.ok(rms>5,'Windows loopback must contain non-silent audio');
      results.flows.realWindowsLoopback={durationMs:saved.durationMs,systemRms:rms,microphoneEnabled:false,uploaded:false};results.ok=true;
    } catch(error) {results.ok=false;results.errors.push(error.stack||String(error));process.exitCode=1;}
    finally { await js(`window.testTone?.stop();window.testToneContext?.close();`).catch(()=>{});results.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'system-loopback.json'),JSON.stringify(results,null,2)); }
    return;
  }
  try {
    for (let n = 0; n < 40 && !await js(`document.querySelector('#app')?.getAttribute('aria-busy') === 'false'`); n++) await sleep(100);
    assert.equal(await js(`document.querySelector('#app')?.getAttribute('aria-busy')`), 'false');
    mainWindow.show(); await navigate('notetaker');
    await shot('01-notetaker-empty');
    results.flows.notetakerVisible = await js(`document.querySelector('#section-notetaker').offsetParent !== null`);
    await click('#section-notetaker button', '+ Notitie');
    await js(`(() => {const el=document.querySelector('.meeting-title');el.value='Projectoverleg — testnotitie';el.dispatchEvent(new Event('change'));})()`); await sleep(200);
    let note = services.meetings.list().find(m => m.title === 'Projectoverleg — testnotitie');
    assert.ok(note); results.flows.createAndRenameNote = true;
    await shot('02-note-detail');
    await navigate('dictionary');
    await js(`document.getElementById('dictionary-term').value='Jot Test';document.getElementById('dictionary-form').requestSubmit()`); await sleep(200);
    assert.ok(storage.settings.dictionary.includes('Jot Test')); results.flows.dictionary = true;
    await navigate('snippets');
    await js(`(() => {const f=document.querySelector('#section-snippets form');f.elements.label.value='mijn groet';f.elements.text.value='Met vriendelijke groet, Fahim';f.requestSubmit();})()`);await sleep(200);
    assert.equal(storage.settings.snippets[0]?.trigger,'mijn groet');results.flows.snippets = true;
    await navigate('scratchpad');
    await js(`const e=document.getElementById('scratchpad-editor');e.value='Notitie blijft lokaal staan.';e.dispatchEvent(new Event('input'));`);
    for(let n=0;n<30&&storage.settings.scratchpad!=='Notitie blijft lokaal staan.';n++)await sleep(100);
    assert.equal(storage.settings.scratchpad,'Notitie blijft lokaal staan.');results.flows.scratchpad = true;
    await js(`document.getElementById('scratchpad-editor').value='Laatste wijziging voor navigatie';document.getElementById('scratchpad-editor').dispatchEvent(new Event('input'));window.flowNavigate('history');`);await sleep(300);
    assert.equal(storage.settings.scratchpad,'Laatste wijziging voor navigatie');results.flows.immediateDraftNavigation = true;
    await navigate('general');await shot('03-settings-general');
    results.flows.hudDockPositions = {};
    assert.equal(await hudWindow.webContents.executeJavaScript(`document.getElementById('pill').classList.contains('idle')`), true);
    for (const position of ['left', 'right', 'center']) {
      await js(`document.getElementById('hud-position').value=${JSON.stringify(position)};document.getElementById('hud-position').dispatchEvent(new Event('change'))`);
      await sleep(150);
      assert.equal(storage.settings.hudPosition, position);
      assert.ok(hudWindow.isVisible());
      assert.equal(await hudWindow.webContents.executeJavaScript(`document.body.dataset.dock`), position);
      results.flows.hudDockPositions[position] = hudWindow.getBounds();
      const vertical = position !== 'center';
      assert.equal(hudWindow.getBounds().height > hudWindow.getBounds().width, vertical);
      const pillBounds = await hudWindow.webContents.executeJavaScript(`(() => {const r=document.getElementById('pill').getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y};})()`);
      assert.equal(pillBounds.height > pillBounds.width, vertical);
      assert.ok(pillBounds.x >= 0 && pillBounds.y >= 0, 'Rotated pill remains inside its window');
      await shot(`hud-idle-${position}`, hudWindow);
    }
    assert.equal(results.flows.hudDockPositions.left.y, results.flows.hudDockPositions.right.y);
    assert.ok(results.flows.hudDockPositions.center.y > results.flows.hudDockPositions.left.y);
    await js(`window.jot.updateSettings({showIdleIndicator:false})`);
    assert.equal(storage.settings.showIdleIndicator,true);
    await hudWindow.webContents.executeJavaScript(`window.jot.hideHud()`);await sleep(100);
    assert.ok(hudWindow.isVisible());results.flows.hudAlwaysVisible=true;
    const point = await hudWindow.webContents.executeJavaScript(`(() => { const r=document.getElementById('idle-hit').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
    hudWindow.webContents.sendInputEvent({type:'mouseMove', ...point});
    await sleep(250);
    assert.equal(await hudWindow.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.idle-action')).opacity`), '1');
    assert.equal(await hudWindow.webContents.executeJavaScript(`getComputedStyle(document.getElementById('wave')).display`), 'none');
    await shot('hud-hover-record', hudWindow);
    results.flows.idleHoverRecordButton = true;
    hudWindow.webContents.sendInputEvent({type:'mouseDown', button:'left', clickCount:1, ...point});
    await sleep(60);
    hudWindow.webContents.sendInputEvent({type:'mouseMove', x:point.x+25,y:point.y, modifiers:['leftButtonDown']});
    await sleep(60);
    hudWindow.webContents.sendInputEvent({type:'mouseUp', button:'left', clickCount:1,x:point.x+25,y:point.y});
    await sleep(150);
    assert.equal(sessions.current, null, 'Dragging the idle pill must not start dictation');
    assert.equal(sessions.state, 'idle'); results.flows.dragDoesNotRecord = true;
    mainWindow.close(); await sleep(100); assert.ok(hudWindow.isVisible());mainWindow.show();
    await navigate('connectors');await shot('04-settings-calendar');
    await navigate('mcp');await shot('05-settings-mcp');
    await js(`document.getElementById('settings-dialog').close()`);
    const mcp = await js(`window.jot.mcpTest()`); assert.ok(mcp.ok);results.flows.localMcp = mcp;
    await navigate('insights');await shot('06-insights');
    await navigate('history');await shot('07-dictation');
    mainWindow.setMinimumSize(360, 540); mainWindow.setSize(375, 760);await sleep(250);
    await navigate('notetaker');await shot('08-narrow-375');
    results.flows.narrowNoHorizontalOverflow = await js(`document.documentElement.scrollWidth <= innerWidth`);
    mainWindow.setSize(1366,900);
    hudWindow.webContents.send('hud:state',{state:'recording',mode:'meeting',mic:true,system:true});hudWindow.showInactive();await shot('09-hud',hudWindow);
    // Exercise the real Chromium audio capture path using its explicit synthetic
    // microphone device. No ambient audio or network upload is part of this test.
    storage.updateSettings({meetingAutoTranscribe:false});
    await navigate('notetaker');
    const recorded = await js(`window.jot.startMeeting({title:'Synthetic microphone smoke',microphone:true,systemAudio:false})`);
    await sleep(1800);
    await js(`window.jot.pauseMeeting()`);assert.equal(services.manager.state.state,'paused');
    await sleep(200);await js(`window.jot.resumeMeeting()`);await sleep(700);
    const saved = await js(`window.jot.stopMeeting()`);
    assert.ok(saved.durationMs > 1000);assert.equal(saved.id,recorded.id);results.flows.syntheticCapture = {durationMs:saved.durationMs,state:saved.state};
    const playlist = await js(`window.jot.meetingAudio(${JSON.stringify(saved.id)})`);assert.ok(playlist.length);
    results.flows.audioPlayback = await js(`new Promise((resolve,reject)=>{const a=document.createElement('audio');a.onloadedmetadata=()=>resolve({duration:a.duration});a.onerror=()=>reject(Error('Audio protocol failed'));a.src=${JSON.stringify(playlist[0].url)};})`);
    const interrupted=await js(`window.jot.startMeeting({title:'Crash recovery smoke',microphone:true,systemAudio:false})`);
    await sleep(1400);services.captureWindow.webContents.forcefullyCrashRenderer();
    for(let n=0;n<40&&services.active();n++)await sleep(100);
    const recovered=services.meetings.get(interrupted.id);assert.equal(recovered.state,'saved');assert.ok(recovered.durationMs>400);
    await sleep(1000);
    await js(`window.jot.startMeeting({title:'Recorder restart smoke',microphone:true,systemAudio:false})`);await sleep(700);await js(`window.jot.stopMeeting()`);
    results.flows.captureRendererCrashRecovery={durationMs:recovered.durationMs,restartSucceeded:true};
    await shot('10-notetaker-populated');
    if (process.env.JOT_LOOPBACK_TEST) {
      await js(`window.testToneContext = new AudioContext(); window.testTone = window.testToneContext.createOscillator(); window.testGain = window.testToneContext.createGain(); window.testGain.gain.value = 0.015; window.testTone.connect(window.testGain).connect(window.testToneContext.destination); window.testTone.start(); window.testToneContext.resume();`);
      let dual;
      try {
        await js(`window.jot.startMeeting({title:'Synthetic dual-source smoke',microphone:true,systemAudio:true})`);
        await sleep(2200);dual = await js(`window.jot.stopMeeting()`);
      } finally { await js(`window.testTone.stop(); window.testToneContext.close();`); }
      const manifest = services.meetings.manifest(dual.id);
      assert.ok(manifest.sources.mic.samples > 16000);assert.ok(manifest.sources.system.samples > 16000);
      const pcm = fs.readFileSync(services.meetings.audioPath(dual.id,'system',0)).subarray(44);
      let energy=0;for(let n=0;n<pcm.length;n+=2)energy+=pcm.readInt16LE(n)**2;
      const rms=Math.sqrt(energy/(pcm.length/2));assert.ok(rms>2, 'System track must contain actual sound');
      results.flows.syntheticDualCapture={durationMs:dual.durationMs,systemRms:rms};
    }
    results.consoleErrors = [...captureConsoleErrors];
    assert.equal(results.consoleErrors.length,0,'Renderer console errors');
    assert.ok(results.flows.narrowNoHorizontalOverflow);
    results.ok = true;
  } catch (error) { results.ok = false;results.errors.push(error.stack || String(error));await shot('failure');process.exitCode = 1; }
  finally {results.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'smoke.json'),JSON.stringify(results,null,2));}
}
module.exports = { run };
