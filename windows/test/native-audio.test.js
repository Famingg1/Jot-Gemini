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
});
