'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Usage,tokenCounts}=require('../src/main/usage');
test('monthly totals separate local calendar months, retain deleted recordings and never double count updates',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-usage-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const usage=new Usage(root);
 const dict={id:'d',startedAt:'2026-09-01T00:01:00',durationSeconds:60,status:'complete'};
 usage.recording('dictation',dict);usage.recording('dictation',dict);usage.recording('dictation',{...dict,id:'cancel',status:'cancelled'});
 usage.recording('meeting',{id:'m',startedAt:'2026-08-31T23:59:00',durationMs:3600000,state:'saved'});
 assert.equal(usage.snapshot('2026-09').dictations,1);assert.equal(usage.snapshot('2026-09').dictationMs,60000);assert.equal(usage.snapshot('2026-08').meetings,1);
 assert.equal(new Usage(root).snapshot('2026-09').dictations,1);assert.throws(()=>usage.snapshot('../bad'));
});
test('token-metered responses replace the blended estimate for that attempt',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-usage-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const usage=new Usage(root),at=new Date('2026-09-10T12:00:00');
 usage.audio('gemini-3.5-transcribe',60000,at);assert.equal(usage.snapshot('2026-09').cost.usd,.005);
 usage.settle('gemini-3.5-transcribe',{total_input_tokens:1500,total_output_tokens:400},60000,at);
 assert.equal(Math.round(usage.snapshot('2026-09').cost.usd*1e6),7800);assert.equal(usage.snapshot('2026-09').cost.metered,1);
 usage.settle('gemini-3.5-transcribe',{},60000,at);usage.settle('other-model',{total_input_tokens:1,total_output_tokens:1},60000,at);
 assert.equal(Math.round(usage.snapshot('2026-09').cost.usd*1e6),7800);
 usage.audio('scribe_v2',3600000,at);assert.equal(Math.round(usage.snapshot('2026-09').cost.usd*1e4),2278);assert.equal(usage.snapshot('2026-09').cost.unpriced,0);
 assert.deepEqual(tokenCounts({input_tokens_by_modality:[{modality:'AUDIO',tokens:1000}],output_tokens_by_modality:[{modality:'TEXT',tokens:50}]}),{input:1000,output:50});
 assert.equal(tokenCounts({promptTokenCount:'x'}),null);
});
test('cost estimates count each audio attempt, flag unknown models, persist, and handle corrupt ledger safely',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-usage-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const usage=new Usage(root),at=new Date('2026-09-10T12:00:00');
 usage.audio('gemini-3.5-transcribe',3600000,at);usage.audio('gemini-3.5-transcribe',3600000,at);usage.audio('future-model',60000,at);
 assert.equal(usage.snapshot('2026-09').cost.usd,.6);assert.equal(usage.snapshot('2026-09').cost.requests,3);assert.equal(usage.snapshot('2026-09').cost.unpriced,1);
 assert.equal(new Usage(root).snapshot('2026-09').cost.usd,.6);fs.writeFileSync(usage.file,'broken');const broken=new Usage(root);assert.throws(()=>broken.snapshot());assert.equal(fs.readFileSync(usage.file,'utf8'),'broken');
});
