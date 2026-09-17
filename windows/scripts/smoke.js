'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app } = require('electron');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run({ mainWindow, hudWindow, services, storage, sessions, captureConsoleErrors }) {
  const root = path.resolve(process.env.JOT_CAPTURE_DIR || path.join(__dirname, '..', 'screenshots'));
  fs.mkdirSync(root, { recursive: true });
  storage.updateSettings({meetingAudioApp:'all'});
  const results = { startedAt: new Date().toISOString(), flows: {}, errors: [], profile: storage.root };
  const js = code => mainWindow.webContents.executeJavaScript(code, true);
  const shot = async (name, window = mainWindow) => { await sleep(250); fs.writeFileSync(path.join(root, `${name}.png`), (await window.webContents.capturePage()).toPNG()); };
  const navigate = async id => { await js(`window.flowNavigate(${JSON.stringify(id)})`); await sleep(250); };
  const click = async (selector, text) => { await js(`(() => { const candidates = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.offsetParent !== null); const el = ${text ? `candidates.find(e=>e.textContent.includes(${JSON.stringify(text)}))` : 'candidates[0]'}; if(!el) throw Error('Missing visible control: '+${JSON.stringify(text || selector)}); el.click(); })()`); await sleep(200); };
  const externalTone = () => {
    const pcm=Buffer.alloc(16000*3*2);
    for(let n=0;n<pcm.length/2;n++)pcm.writeInt16LE(Math.round(600*Math.sin(2*Math.PI*523*n/16000)*Math.min(1,n/800,(pcm.length/2-n)/800)),n*2);
    const file=path.join(root,'diagnostic-tone.wav');fs.writeFileSync(file,require('../src/main/wav').pcmToWav(pcm,16000));
    const child=require('node:child_process').spawn('powershell.exe',['-NoProfile','-Command','$p=New-Object System.Media.SoundPlayer $env:JOT_TEST_TONE; $p.PlaySync();'],{windowsHide:true,env:{...process.env,JOT_TEST_TONE:file},stdio:'ignore'});
    return new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Test tone failed')));});
  };
  if(process.env.JOT_LIVE_VERIFY){
    let live;
    try{
      const real=new (require('../src/main/storage').JotStorage)(path.join(app.getPath('appData'),'jot-windows'),storage.safeStorage);
      const key=real.apiKey();assert.ok(key,'Configured local Gemini key required');
      const wav=fs.readFileSync(process.env.JOT_LIVE_WAV);let offset=12,pcm;
      while(offset+8<wav.length){const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data'){pcm=wav.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
      assert.ok(pcm);let document,firstTextOffset=null,hadInterim=false;
      live=new (require('../src/main/meeting-live').MeetingLive)({id:'synthetic-live-test',apiKey:key,language:'en-US',save:value=>{document=structuredClone(value);if(value.interim)hadInterim=true;if(firstTextOffset===null&&(value.interim||value.segments.length))firstTextOffset=live.offset;}});live.start();
      for(let n=0;n<100&&!live.ready;n++)await sleep(100);assert.ok(live.ready,'Live endpoint setup must succeed');
      for(let n=0;n<pcm.length;n+=3200){live.push({source:'mix',sampleOffset:n/2,pcm:pcm.subarray(n,n+3200)});await sleep(100);}
      await live.flush();for(let n=0;n<70&&!document?.segments.length;n++)await sleep(100);
      assert.ok(document?.segments.some(s=>/meeting|project|schedule/i.test(s.text)),'Expected synthetic meeting speech in real streaming response');await live.finish();
      assert.ok(firstTextOffset<pcm.length/32,'Transcript arrives before audio playback ends');
      results.ok=true;results.flows.live={transcript:document.segments.map(s=>s.text),firstTextOffset,audioDurationMs:pcm.length/32,hadInterim,syntheticAudio:true,provider:'gemini-3.5-transcribe-live'};
    }catch(error){results.ok=false;results.errors.push(error.message);process.exitCode=1;}finally{live?.closeNow();fs.writeFileSync(path.join(root,'live-verification.json'),JSON.stringify(results,null,2));}
    return;
  }
  if(process.env.JOT_HUD_NOTE_TEST){
    try{
      await sleep(600);hudWindow.showInactive();const hj=code=>hudWindow.webContents.executeJavaScript(code,true);
      const point=await hj(`(()=>{const r=document.getElementById('pill').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);hudWindow.webContents.sendInputEvent({type:'mouseMove',...point});await sleep(300);await shot('hud-two-buttons',hudWindow);
      assert.ok(await hj(`document.getElementById('note-hit').getBoundingClientRect().width>0`));await hj(`document.getElementById('note-hit').click()`);await sleep(400);assert.ok(await js(`document.getElementById('new-meeting-dialog').open`));await js(`document.getElementById('new-meeting-dialog').close()`);
      await click('button','Instellingen');await sleep(250);
      await js(`document.querySelector('#note-shortcut-list button').click()`);await sleep(250);
      await js(`for(const [type,code] of [['keydown','AltRight'],['keydown','KeyN'],['keyup','KeyN'],['keyup','AltRight']])document.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));document.getElementById('shortcut-save').click()`);await sleep(350);
      assert.deepEqual(storage.settings.noteHotkeys,[['AltRight','KeyN']]);assert.deepEqual(require('../src/renderer/hotkeys').fromSettings(storage.settings),[['ControlRight']]);await shot('notetaker-shortcut');
      await assert.rejects(js(`window.jot.updateSettings({noteHotkeys:[['ControlRight']]})`));
      assert.equal(captureConsoleErrors.filter(s=>!s.includes('overlapt')).length,0);results.ok=true;results.flows.noteShortcut={recorded:true,separateFromDictation:true,conflictsRefused:true};
    }catch(error){results.ok=false;results.errors.push(error.stack||String(error));process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'hud-note.json'),JSON.stringify(results,null,2));}return;
  }
  if(process.env.JOT_PANEL_TEST){
    const panelErrors=[];
    try{
      storage.updateSettings({meetingAutoTranscribe:false});await sleep(600);
      services.calendar.cache.events=[{id:'test-event',title:'Testafspraak',start:new Date().toISOString(),attendees:[{name:'Alice',email:'alice@example.test'},{name:'Bob',email:'bob@example.test'}]}];
      await navigate('notetaker');await click('button','Nieuwe opname');
      assert.deepEqual(await js(`[...document.querySelector('#meeting-audio-app').options].map(o=>o.value)`),['desktop-filtered','chrome','teams','zoom']);
      await js(`document.querySelector('#meeting-title').value='Projectoverleg · TakkieAI';document.querySelector('#new-meeting-dialog').dataset.event='test-event';document.querySelector('#meeting-audio-app').value='desktop-filtered';document.querySelector('#new-meeting-form').requestSubmit()`);
      for(let n=0;n<60&&!services.panel.window;n++)await sleep(250);
      assert.ok(services.panel.window,'Separate meeting window opens');const panel=services.panel.window;
      panel.webContents.on('console-message',(_e,d)=>{if(d.level==='error')panelErrors.push(d.message);});
      const pj=code=>panel.webContents.executeJavaScript(code,true);
      await sleep(1600);assert.ok(services.active());assert.equal(services.manager.state.audioApp,'desktop-filtered');
      await pj(`document.querySelector('#notes').value='Bespreken: planning en volgende stappen.';document.querySelector('#notes').dispatchEvent(new Event('input'));window.flushMeetingNotes()`);
      assert.equal(services.meetings.get(services.manager.active.id).notes,'Bespreken: planning en volgende stappen.');
      await shot('meeting-panel-notes',panel);await pj(`document.querySelector('#tab-transcript').click()`);await shot('meeting-panel-transcript',panel);
      await pj(`document.querySelector('#pause').click()`);await sleep(800);assert.equal(services.manager.state.state,'paused');await shot('meeting-panel-paused',panel);
      await pj(`document.querySelector('#pause').click()`);await sleep(700);assert.equal(services.manager.state.state,'recording');
      panel.close();await sleep(500);assert.equal(panel.isVisible(),false);assert.ok(services.active());await services.panel.open(services.manager.active.id);
      panel.setSize(375,650);await sleep(300);assert.ok(await pj(`document.documentElement.scrollWidth<=innerWidth`));await shot('meeting-panel-375',panel);
      const id=services.manager.active.id;await pj(`document.querySelector('#stop').click()`);await sleep(900);assert.equal(services.active(),false);assert.equal(services.meetings.meta(id).state,'saved');
      await pj(`document.querySelector('#tab-summary').click()`);await shot('meeting-panel-summary',panel);
      assert.ok(await pj(`!document.querySelector('#generate').hidden`));
      const saved=services.meetings.get(id);assert.ok(saved.durationMs>1500);assert.ok(saved.manifest.sources.system.samples>0);assert.ok(saved.manifest.sources.mic.samples>0);
      assert.equal(saved.participants[0].name,'Alice');
      // Seed local fixtures, not fabricated product content, to verify rendered results and error state.
      services.meetings.saveDocument(id,'summary',{summary:'Planning besproken.',decisions:['Vrijdag opleveren.'],actions:[{text:'Concept uitwerken',owner:'Fahim'}]});
      services.meetings.saveDocument(id,'transcript',{segments:[{startMs:0,speakerId:'you',text:'Laten we de planning bespreken.'}]});services.manager.emit('changed');await sleep(300);await shot('meeting-panel-results',panel);
      await pj(`document.querySelector('#tab-transcript').click()`);assert.equal(await pj(`document.querySelector('.speaker-label').textContent`),'Spreker 1');await pj(`document.querySelector('.speaker-label').click();const input=document.querySelector('.speaker-heading input');input.value='Alice';input.dispatchEvent(new Event('change'))`);await sleep(300);assert.equal(services.meetings.meta(id).speakers.you,'Alice');await shot('meeting-panel-speaker-name',panel);
      services.meetings.saveMeta(id,{error:{message:'Test: verbinding onderbroken.'}});services.manager.emit('changed');await sleep(300);await shot('meeting-panel-error',panel);
      assert.ok(await pj(`!document.querySelector('#error').hidden`));assert.equal(panelErrors.length,0);
      results.flows.panel={durationMs:saved.durationMs,app:'desktop-filtered',pauseResume:true,notesSaved:true,closeKeepsRecording:true,narrowWidth:375,consoleErrors:panelErrors,uploaded:false};results.ok=true;
    }catch(error){results.ok=false;results.errors.push(error.stack||String(error));process.exitCode=1;}
    finally{fs.writeFileSync(path.join(root,'panel.json'),JSON.stringify(results,null,2));}
    return;
  }
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
    if (process.env.JOT_AUDIO_DIAGNOSTIC) {
      storage.updateSettings({meetingAutoTranscribe:false});
      results.devices=await services.captureWindow.webContents.executeJavaScript(`navigator.mediaDevices.enumerateDevices().then(ds=>ds.map(d=>({kind:d.kind,label:d.label})))`);
      for(const options of [{microphone:true,systemAudio:false},{microphone:false,systemAudio:true},{microphone:true,systemAudio:true}]) {
        const test={...options};
        try {
          const meeting=await js(`window.jot.startMeeting(${JSON.stringify({title:'Local hardware diagnostic',...options})})`);
          if(options.systemAudio)await externalTone();else await sleep(2200);
          const saved=await js(`window.jot.stopMeeting()`);
          test.ok=true;test.durationMs=saved.durationMs;
          test.samples=services.meetings.manifest(meeting.id).sources;
          if(options.systemAudio){const pcm=fs.readFileSync(services.meetings.audioPath(meeting.id,'system',0)).subarray(44);let energy=0;for(let n=0;n<pcm.length;n+=2)energy+=pcm.readInt16LE(n)**2;test.systemRms=Math.sqrt(energy/(pcm.length/2));assert.ok(test.systemRms>5,'Real system audio must contain the external tone');}
        }catch(error){test.ok=false;test.error=error.message;}
        results.flows[options.microphone?(options.systemAudio?'both':'mic'):'system']=test;
        await sleep(400);
      }
      results.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'hardware.json'),JSON.stringify(results,null,2));return;
    }
    try {
      storage.updateSettings({ meetingAutoTranscribe: false });
      await sleep(500);
      await js(`window.jot.startMeeting({title:'Local Windows loopback verification',microphone:false,systemAudio:true})`);
      await externalTone();
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
    await js(`document.getElementById('shortcut-add').click()`);await sleep(150);
    assert.equal(await js(`document.getElementById('shortcut-recorder').hidden`),false);
    await js(`for(const [type,code] of [['keydown','ControlLeft'],['keydown','KeyK'],['keyup','KeyK'],['keyup','ControlLeft']])document.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true,cancelable:true}));document.getElementById('shortcut-save').click();`);await sleep(250);
    assert.deepEqual(storage.settings.hotkeys,[['ControlRight'],['ControlLeft','KeyK']]);
    assert.equal(sessions.current,null,'Recording a shortcut must not start audio');
    await shot('settings-custom-shortcuts');
    await js(`document.getElementById('shortcut-add').click()`);await sleep(100);
    await js(`document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true,cancelable:true}))`);await sleep(100);
    assert.equal(await js(`document.getElementById('shortcut-recorder').hidden`),true);
    assert.equal(storage.settings.hotkeys.length,2);results.flows.recordCustomShortcut=true;
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
      let dual;
      try {
        await js(`window.jot.startMeeting({title:'Synthetic dual-source smoke',microphone:true,systemAudio:true})`);
        await externalTone();dual = await js(`window.jot.stopMeeting()`);
      } finally { /* The external test tone process exits after playback. */ }
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
