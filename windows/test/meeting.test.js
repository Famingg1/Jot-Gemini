'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MeetingStorage, MeetingWriter, RATE } = require('../src/main/meeting-storage');
const { MeetingManager } = require('../src/main/meeting-manager');
const { MeetingTranscriber, validateTranscript, validateSummary } = require('../src/main/meeting-transcriber');
function setup(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(),'jot-meeting-')); t.after(() => fs.rmSync(root,{recursive:true,force:true})); return new MeetingStorage(root); }
function record(storage, seconds = 1) { const meta = storage.create({ title: 'Test meeting' }); const writer = new MeetingWriter(storage,meta.id); for (let sequence=0; sequence<seconds; sequence++) for (const source of ['mic','system','mix']) writer.append({source,sequence,sampleOffset:sequence*RATE,pcm:Buffer.alloc(RATE*2,sequence%127)}); writer.close(); storage.saveMeta(meta.id,{state:'saved',durationMs:seconds*1000}); return meta.id; }
test('bounded writer segments at 30s, durable headers and independent sources', t => { const storage=setup(t); const id=record(storage,31); for (const source of ['mic','system','mix']) { const a=fs.readFileSync(storage.audioPath(id,source,0)); const b=fs.readFileSync(storage.audioPath(id,source,1)); assert.equal(a.length,44+RATE*60); assert.equal(a.readUInt32LE(40),RATE*60); assert.equal(b.length,44+RATE*2); assert.equal(storage.manifest(id).sources[source].samples,RATE*31); } });
test('reject malformed ids, oversized blocks and gaps without accepting bad audio', t => { const storage=setup(t); assert.throws(()=>storage.directory('../escape')); const meta=storage.create(); const writer=new MeetingWriter(storage,meta.id); assert.throws(()=>writer.append({source:'mix',sequence:1,sampleOffset:0,pcm:Buffer.alloc(32)}),/sequence/); assert.throws(()=>writer.append({source:'mix',sequence:0,sampleOffset:0,pcm:Buffer.alloc(64000)}),/size/); assert.throws(()=>writer.append({source:'../x',sequence:0,sampleOffset:0,pcm:Buffer.alloc(32)})); });
test('crash recovery repairs uncheckpointed PCM tail and odd partial sample', t => { const storage=setup(t); const id=record(storage); storage.saveMeta(id,{state:'recording'}); const file=storage.audioPath(id,'mix',0); fs.appendFileSync(file,Buffer.alloc(321)); assert.deepEqual(storage.recover(),[id]); const wav=fs.readFileSync(file); assert.equal(wav.readUInt32LE(40),RATE*2+320); assert.equal(wav.length,44+RATE*2+320); assert.equal(storage.get(id).state,'saved'); assert.equal(storage.get(id).recovered,true); });
test('speaker edits, private default, export and notes survive processing state updates', t => { const storage=setup(t); const note=storage.createNote(); assert.equal(note.shared,false); storage.update(note.id,{notes:'My **own** notes',title:'Renamed',shared:true,speakers:{'b0-speaker1':'Fahim'}}); storage.saveMeta(note.id,{state:'saved'}); assert.equal(storage.get(note.id).notes,'My **own** notes'); assert.match(storage.export(note.id,'md').content,/Renamed/); assert.throws(()=>storage.export(note.id,'exe')); });
test('stop awaits capture flush ACK before transcription and preserves final block', async t => { const storage=setup(t); let resolveStop; let manager; let seenSamples; const capture={command:async(type)=> { if(type==='stop') await new Promise(resolve=>{resolveStop=resolve;}); }}; manager=new MeetingManager({storage,capture,getApiKey:()=>'',getSettings:()=>({}),transcriber:{process:async(id)=>{seenSamples=storage.manifest(id).sources.mix.samples;},cancel(){}}}); const meta=await manager.start({system:false}); const stop=manager.stop(); assert.equal(manager.state.state,'finalizing'); manager.acceptChunk({id:meta.id,source:'mix',sequence:0,sampleOffset:0,pcm:Buffer.alloc(1000)}); assert.equal(seenSamples,undefined); resolveStop(); await stop; assert.equal(seenSamples,500); assert.equal(manager.state.state,'idle'); });
test('schema rejects impossible timestamps and nonexistent source references', () => { assert.throws(()=>validateTranscript({segments:[{text:'test',startMs:0,endMs:99999}]},1000,0)); const segments=validateTranscript({segments:[{text:'Hoi',startMs:10,endMs:200,speakerId:'speaker1'}]},1000,1); assert.equal(segments[0].startMs,300010); const summary=validateSummary({summary:'S',decisions:[],actions:[{text:'Do it',sourceIds:['fake','b1-s0']}]},segments); assert.deepEqual(summary.actions[0].sourceIds,['b1-s0']); assert.equal(summary.actions[0].owner,null); });
test('retry uses committed transcript batches after summary failure', async t => { const storage=setup(t); const id=record(storage); let calls=0; let fail=true; const clientFactory=async()=>({models:{generateContent:async()=>{calls++; if(calls===1) return {text:JSON.stringify({segments:[{text:'We gaan testen.',startMs:0,endMs:900,speakerId:'speaker1'}]})}; if(fail) throw new Error('network failure'); return {text:JSON.stringify({summary:'Test afgesproken',decisions:[],actions:[]})}; }}}); const tx=new MeetingTranscriber({storage,getApiKey:()=> 'key',getSettings:()=>({meetingModel:'gemini-2.5-flash'}),clientFactory}); await tx.process(id); assert.equal(storage.get(id).state,'saved'); assert.equal(storage.get(id).transcript.segments.length,1); fail=false; await tx.process(id); assert.equal(calls,3); assert.equal(storage.get(id).state,'ready'); });
test('deleting in-flight AI job cannot recreate the meeting', async t => { const storage=setup(t); const id=record(storage); let resolve; const tx=new MeetingTranscriber({storage,getApiKey:()=> 'key',getSettings:()=>({meetingModel:'gemini-2.5-flash'}),clientFactory:async()=>({models:{generateContent:()=>new Promise(r=>{resolve=r;})}})}); const pending=tx.process(id); await new Promise(r=>setImmediate(r)); tx.cancel(id); storage.delete(id); resolve({text:JSON.stringify({segments:[]})}); await pending; assert.equal(fs.existsSync(storage.directory(id)),false); });
test('retention only removes audio of completed notes; transcript remains', t => { const storage=setup(t); const done=record(storage); const queued=record(storage); storage.saveMeta(done,{state:'ready',endedAt:'2020-01-01T00:00:00Z'}); storage.saveMeta(queued,{endedAt:'2020-01-01T00:00:00Z'}); storage.cleanupAudio(7); assert.equal(fs.existsSync(storage.audioPath(done,'mix',0)),false); assert.equal(fs.existsSync(storage.audioPath(queued,'mix',0)),true); assert.ok(storage.get(done)); });
test('worklet shared clock resamples both sources and flushes last words without drift', () => {
  const vm = require('node:vm'); let Processor; const samples={mic:0,system:0,mix:0}; let flushed=false;
  const context = vm.createContext({ sampleRate:48000, Int16Array, AudioWorkletProcessor:class { constructor() { this.port={postMessage:message=> { if(message.type==='chunk') { assert.equal(message.sampleOffset,samples[message.source]); const pcm=new Int16Array(message.pcm); samples[message.source]+=pcm.length; assert.equal(pcm[0],message.source==='mic'?8192:message.source==='system'?16384:12288); } if(message.type==='flushed') flushed=true; }}; } }, registerProcessor:(_name,p)=>{Processor=p;} });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/audio-worklet.js'),'utf8'),context);
  const processor=new Processor({processorOptions:{sources:[true,true]}}); const input=[[new Float32Array(128).fill(0.25)],[new Float32Array(128).fill(0.5)]];
  for(let i=0;i<22501;i++) processor.process(input);
  processor.port.onmessage({data:{type:'flush',token:'stop'}});
  assert.equal(samples.mic,Math.floor(22501*128/3)); assert.equal(samples.mic,samples.system); assert.equal(samples.mic,samples.mix); assert.equal(flushed,true); assert.equal(processor.buffers[0].length,8000);
});
test('one simulated hour writes bounded dual-source segments and recovers final samples', t => {
  const storage=setup(t); const id=record(storage,3600); const manifest=storage.manifest(id);
  for(const source of ['mic','system','mix']) { assert.equal(manifest.sources[source].samples,RATE*3600); assert.equal(fs.readdirSync(path.dirname(storage.audioPath(id,source,0))).length,120); assert.equal(fs.statSync(storage.audioPath(id,source,119)).size,44+RATE*60); }
  storage.saveMeta(id,{state:'recording'}); storage.recover(); assert.equal(storage.get(id).durationMs,3600000);
});
test('capture transitions reject overlapping stop and stale ACK after source failure', async t => {
  const storage=setup(t); let finishStart; const manager=new MeetingManager({storage,getApiKey:()=>'',getSettings:()=>({}),capture:{command:async(type)=>{if(type==='start') await new Promise(r=>{finishStart=r;});}}});
  const start=manager.start({system:false}); await assert.rejects(manager.stop(),/Wacht/); const id=manager.active.id; await manager.captureFault({id,message:'Unplugged'}); finishStart(); await assert.rejects(start,/onderbroken/); assert.equal(storage.get(id).state,'saved'); assert.equal(manager.active,null);
});
test('disk failure cannot leave capture active even when fault manifest cannot be written', async t => {
  const storage=setup(t); let aborted=false; const manager=new MeetingManager({storage,getApiKey:()=>'',getSettings:()=>({}),capture:{command:async(type)=>{if(type==='abort') aborted=true;}}}); const meta=await manager.start(); const realSave=storage.saveMeta; storage.saveMeta=()=>{throw new Error('ENOSPC');}; manager.active.writer.close=()=>{throw new Error('EIO');}; await manager.captureFault({id:meta.id,message:'Disk full'}); assert.equal(manager.active,null); assert.equal(aborted,true); storage.saveMeta=realSave;
});
test('auto-transcription disabled saves without any AI request', async t => {
  const storage=setup(t); let calls=0; const manager=new MeetingManager({storage,getApiKey:()=>'',getSettings:()=>({meetingAutoTranscribe:false}),capture:{command:async()=>{}},transcriber:{process:async()=>{calls++;}}}); const meta=await manager.start(); await manager.stop(); assert.equal(calls,0); assert.equal(storage.get(meta.id).state,'saved');
});
test('specialist annotation adapter keeps speaker turns and exact word-derived timestamps', () => {
  const { specialistTranscript, deduplicateOverlap } = require('../src/main/meeting-transcriber');
  const parsed = specialistTranscript({steps:[{type:'model_output',content:[{annotations:[{type:'word_info',text:'Hallo',speaker:'spk_1',start_offset:'0.100s',end_offset:'0.450s'},{type:'word_info',text:'wereld.',speaker:'spk_1',start_offset:'0.500s',end_offset:'0.850s'},{type:'word_info',text:'Ja',speaker:'spk_2',start_offset:'1s',end_offset:'1.4s'}]}]}]});
  assert.equal(parsed.segments.length,2); assert.equal(parsed.segments[0].text,'Hallo wereld.'); assert.equal(parsed.segments[0].startMs,100); assert.equal(parsed.segments[1].speakerId,'spk_2'); assert.throws(()=>specialistTranscript({output_text:'Words without timestamps'}));
  const prior=[{startMs:290000,endMs:300000,text:'Dat is onze afspraak.'}]; const current=[{startMs:298000,endMs:310000,text:'Onze afspraak. We gaan door.'}];
  assert.equal(deduplicateOverlap(prior,current)[0].text,'We gaan door.'); assert.equal(deduplicateOverlap(prior,[{...current[0],startMs:340000}])[0].text,current[0].text);
});
test('network failures schedule bounded retry; auth failures never retry automatically', async t => {
  const storage=setup(t); const id=record(storage); const tx=new MeetingTranscriber({storage,getApiKey:()=> 'key',getSettings:()=>({}),clientFactory:async()=>({interactions:{create:async()=>{throw new Error('network timeout');}}})});
  for(let n=1;n<=6;n++){ await tx.process(id); assert.equal(storage.meta(id).retryCount,n); assert.equal(Boolean(storage.meta(id).nextRetryAt),n<=5); }
  const auth=new MeetingTranscriber({storage,getApiKey:()=>'',getSettings:()=>({})}); await auth.process(id); assert.equal(storage.meta(id).error.code,'auth'); assert.equal(storage.meta(id).nextRetryAt,null);
});
test('AI processing serializes different meetings and skips deleted queued jobs', async t => {
  const storage=setup(t); const first=record(storage), second=record(storage); const calls=[]; let resolveFirst;
  const tx=new MeetingTranscriber({storage,getApiKey:()=> 'key',getSettings:()=>({}),clientFactory:async()=>({interactions:{create:()=>{calls.push('transcribe');return new Promise(resolve=>{resolveFirst=resolve;});}},models:{generateContent:async()=>({text:JSON.stringify({summary:'S',decisions:[],actions:[]})})}})});
  const a=tx.process(first); const b=tx.process(second); await new Promise(resolve=>setImmediate(resolve)); assert.equal(calls.length,1); tx.cancel(second); storage.delete(second); resolveFirst({steps:[]}); await Promise.all([a,b]); assert.equal(calls.length,1); assert.equal(storage.get(first).state,'ready'); assert.equal(fs.existsSync(storage.directory(second)),false);
});
test('stale capture rejection cannot stop a replacement recording', () => {
  const vm=require('node:vm'); const faults=[]; const context=vm.createContext({meetingCapture:{onCommand(){},fault:value=>faults.push(value)},setTimeout,clearTimeout});
  context.meetingCapture.onAppAudio=()=>{};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/capture.js'),'utf8'),context);
  vm.runInContext("const oldCapture={id:'old'}; active={id:'new'}; fail(new Error('late write failure'),oldCapture);",context);
  assert.equal(faults.length,0); assert.equal(vm.runInContext('active.id',context),'new');
});
test('retention honors queued jobs and overlap trimming preserves later repeated speech', t => {
  const storage=setup(t), id=record(storage); storage.saveMeta(id,{state:'ready',endedAt:'2020-01-01T00:00:00Z'}); storage.cleanupAudio(7,Date.now(),new Set([id])); assert.equal(fs.existsSync(storage.audioPath(id,'mix',0)),true);
  const {deduplicateOverlap}=require('../src/main/meeting-transcriber'); const previous=[{text:'Ja.',startMs:200,endMs:500}]; const current=[{text:'Ja.',startMs:600,endMs:900}]; assert.deepEqual(deduplicateOverlap(previous,current),current);
});
test('pause and resume renderer failures finalize saved audio and clear recording state', async t => {
  for(const failingCommand of ['pause','resume']) {
    const storage=setup(t); let aborted=false; const manager=new MeetingManager({storage,getApiKey:()=>'',getSettings:()=>({}),capture:{command:async(type)=>{if(type==='abort')aborted=true;if(type===failingCommand)throw new Error('Capture renderer lost');}}});
    const meta=await manager.start(); manager.acceptChunk({id:meta.id,source:'mix',sequence:0,sampleOffset:0,pcm:Buffer.alloc(3200)});
    if(failingCommand==='resume')await manager.pause(); await assert.rejects(manager[failingCommand](),/renderer lost/);
    assert.equal(manager.state.state,'idle'); assert.equal(manager.active,null); assert.equal(manager.transition,null); assert.equal(storage.get(meta.id).state,'saved'); assert.equal(storage.get(meta.id).durationMs,100); assert.equal(storage.get(meta.id).error.code,'capture'); assert.equal(aborted,true);
  }
});

