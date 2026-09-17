'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
test('process audio shares PCM clock, preserves queued last words and bounds backlog',()=>{
 let Processor;const messages=[];
 const context=vm.createContext({sampleRate:16000,Int16Array,AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>messages.push(m)};}},registerProcessor:(_,p)=>Processor=p});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/audio-worklet.js'),'utf8'),context);
 const p=new Processor({processorOptions:{sources:[true,true],nativeSystem:true}});
 p.port.onmessage({data:{type:'native',pcm:new Int16Array(256).fill(10000).buffer}});
 p.process([[new Float32Array(128).fill(.5)],[]]);
 p.port.onmessage({data:{type:'flush',token:'done'}});
 const chunks=messages.filter(m=>m.type==='chunk');assert.equal(chunks.length,3);
 assert.ok(chunks.every(m=>new Int16Array(m.pcm).length===256));assert.equal(new Int16Array(chunks[1].pcm)[255],10000);assert.equal(new Int16Array(chunks[0].pcm)[255],0);assert.equal(p.nativeSamples,0);
 p.port.onmessage({data:{type:'native',pcm:new Int16Array(32001).buffer}});assert.ok(messages.some(m=>m.type==='fault'));assert.equal(p.nativeSamples,0);
 messages.length=0;
 const delayed=new Processor({processorOptions:{sources:[true,true],nativeSystem:true,nativeLatency:3200}});
 delayed.process([[new Float32Array(128).fill(.5)],[]]);delayed.port.onmessage({data:{type:'flush',token:'tail'}});
 const mic=messages.filter(m=>m.type==='chunk'&&m.source==='mic').flatMap(m=>[...new Int16Array(m.pcm)]);
 assert.equal(mic.length,3328);assert.equal(mic[3327],16384,'Delayed microphone last words are flushed too');
});
test('all apps defaults to music exclusion, old unfiltered preference migrates and explicit bypass is refused',()=>{
 const {resolveMeetingAudioApp,sanitizeSettingsPatch}=require('../src/main/settings');
 assert.equal(resolveMeetingAudioApp(undefined,'all'),'desktop-filtered');
 assert.equal(resolveMeetingAudioApp(undefined,undefined),'desktop-filtered');
 assert.equal(resolveMeetingAudioApp('desktop-filtered','chrome'),'desktop-filtered');
 assert.throws(()=>resolveMeetingAudioApp('all','desktop-filtered'));
 assert.equal(sanitizeSettingsPatch({meetingAudioApp:'all'}).meetingAudioApp,undefined);
});
test('native policy excludes music descendants and ancestors without excluding browsers or double-capturing them',{skip:process.platform!=='win32'},()=>{
 const {execFileSync}=require('node:child_process'),os=require('node:os');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-audio-policy-')),exe=path.join(dir,'test.exe');
 try{execFileSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:exe','/platform:x64','/main:AudioPolicyTests','/out:'+exe,path.resolve(__dirname,'../native/ProcessAudio.cs'),path.resolve(__dirname,'../native/AudioMixer.cs'),path.resolve(__dirname,'fixtures/AudioPolicyTests.cs')],{windowsHide:true});assert.match(execFileSync(exe,[],{windowsHide:true,encoding:'utf8'}),/Music policy passed/);}finally{if(fs.existsSync(exe))fs.unlinkSync(exe);fs.rmdirSync(dir);}
});
