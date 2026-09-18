'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {SessionManager}=require('../src/main/session-manager');const {JotStorage}=require('../src/main/storage');
test('dictation is preparing until matching first-frame ACK; stale ready cannot activate another session',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-ready-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const storage=new JotStorage(root,{isEncryptionAvailable:()=>false});const sessions=new SessionManager({storage,nativeHelper:new EventEmitter(),clipboard:{}});
 sessions.begin();const old=sessions.current.id;assert.equal(sessions.state,'starting');sessions.lock();assert.equal(sessions.state,'starting');sessions.captureReady('stale');assert.equal(sessions.state,'starting');sessions.captureReady(old);assert.equal(sessions.state,'locked');await sessions.cancel();
 sessions.begin();sessions.captureReady(old);assert.equal(sessions.state,'starting');await sessions.cancel();
});
test('finish waits for flush ACK and retains the last PCM block',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-flush-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const storage=new JotStorage(root,{isEncryptionAvailable:()=>false});const sessions=new SessionManager({storage,nativeHelper:new EventEmitter(),clipboard:{}});sessions.process=async()=>{};
 sessions.begin();const {id,directory}=sessions.current;sessions.captureReady(id);sessions.appendChunk(Buffer.alloc(8000,1));sessions.on('recording',command=>{if(command.action==='stop')setTimeout(()=>{sessions.appendChunk(Buffer.alloc(512,2));sessions.captureStopped(id);},40);});await sessions.finish();const wav=fs.readFileSync(path.join(directory,'audio.wav'));assert.equal(wav.length,44+8512);assert.equal(wav.at(-1),2);
});
test('worklet preserves first samples and flushes partial tail, and only signals ready after real input frames',()=>{
 let Processor;const messages=[];const context=vm.createContext({Int16Array,AudioWorkletProcessor:class{constructor(){this.port={postMessage:value=>messages.push(value)};}},registerProcessor:(_name,klass)=>{Processor=klass;}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/dictation-worklet.js'),'utf8'),context);const processor=new Processor();processor.process([]);assert.equal(messages.length,0);
 for(let i=0;i<12;i++)processor.process([[new Float32Array(128).fill(.5)]]);processor.process([[new Float32Array(37).fill(.25)]]);processor.port.onmessage({data:{type:'flush'}});
 const chunks=messages.filter(m=>m.type==='pcm').map(m=>new Int16Array(m.pcm));assert.equal(chunks.reduce((n,c)=>n+c.length,0),1573);assert.equal(chunks[0][0],16384);assert.equal(chunks.at(-1).at(-1),8192);assert.equal(messages.filter(m=>m.type==='ready').length,1);assert.equal(messages.at(-1).type,'flushed');
});
test('wave expands from center outwards with real level and settles flat in silence',()=>{const {shape}=require('../src/renderer/wave-envelope');const quiet=shape(0),speech=shape(.4),loud=shape(1);assert.ok(quiet.every(x=>x===.1));assert.ok(speech[5]>speech[0]);assert.equal(speech[0],.1);assert.ok(loud[0]>speech[0]);assert.ok(loud[5]>loud[0]);assert.equal(loud[0],loud[10]);});
test('unconfirmed final audio is retained and flagged instead of silently transcribed',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-flush-error-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const storage=new JotStorage(root,{isEncryptionAvailable:()=>false});const sessions=new SessionManager({storage,nativeHelper:new EventEmitter(),clipboard:{}});let processed=false;sessions.process=async()=>{processed=true;};sessions.begin();const {id,directory}=sessions.current;sessions.captureReady(id);sessions.appendChunk(Buffer.alloc(8000,1));sessions.on('recording',command=>{if(command.action==='stop')sessions.captureStopped(id,false);});await sessions.finish();assert.equal(processed,false);assert.equal(sessions.state,'error');assert.ok(fs.existsSync(path.join(directory,'audio.wav')));
});
