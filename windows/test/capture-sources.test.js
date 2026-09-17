'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {systemAudio,sourceError}=require('../src/renderer/capture-sources');
test('system capture requests process loopback and falls back only for unsupported/unreadable sources',async()=>{
  const calls=[];const stream={};
  assert.equal(await systemAudio(async c=>{calls.push(c);return stream;}),stream);
  assert.equal(calls[0].audio.restrictOwnAudio,true);
  let count=0;
  assert.equal(await systemAudio(async c=>{if(++count===1)throw Object.assign(Error('driver'),{name:'NotReadableError'});assert.equal(c.audio,true);return stream;}),stream);
  let denied=0;
  await assert.rejects(systemAudio(async()=>{denied++;throw Object.assign(Error('denied'),{name:'NotAllowedError'});}));
  assert.equal(denied,1);
  assert.match(sourceError('system',Error('Could not start audio source')).message,/Computergeluid/);
  assert.match(sourceError('mic',{name:'NotFoundError'}).message,/gekozen microfoon/);
});
