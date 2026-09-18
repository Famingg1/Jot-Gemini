'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {recognize,AutoMeetingStarter}=require('../src/main/meeting-detection');
const base={pid:123,window:'42',process:'chrome',title:'Meet',url:'meet.google.com/abc-defg-hij',buttons:['Leave call','Turn off microphone (Ctrl+D)']};
test('automatic capture requires supported app/domain and active-call controls, never generic microphone activity',()=>{
  assert.equal(recognize(base).provider,'meet');
  for(const process of ['Discord','discord','game','steam','Spotify'])assert.equal(recognize({...base,process}),null);
  for(const url of ['https://youtube.com','https://meet.google.com.attacker.test/abc','https://discord.com/channels/x'])assert.equal(recognize({...base,url}),null);
  for(const buttons of [[],['Join now','Microphone'],['Ask to join','Leave'],['Turn off microphone']])assert.equal(recognize({...base,buttons}),null);
  for(const [process,buttons] of [['ms-teams',['Leave','Mic']],['zoom',['Leave','Mute']],['whatsapp',['End call','Mute microphone']]])assert.ok(recognize({...base,process,url:'',buttons}));
  assert.equal(recognize({...base,buttons:['Gesprek verlaten','Microfoon uitschakelen']}).provider,'meet');
});
test('two detections start once, manual stop remains stopped, unknown scans cannot rearm',async()=>{
  let starts=0,fail=false,snapshot={windows:['42'],candidates:[base]},clock=0;
  const monitor=new AutoMeetingStarter({getSettings:()=>({meetingAutoStart:true}),busy:()=>false,start:async()=>{starts++;},now:()=>clock,scan:async()=>{if(fail)throw Error('timeout');return snapshot;}});
  await monitor.tick();assert.equal(starts,0);await monitor.tick();assert.equal(starts,1);await monitor.tick();assert.equal(starts,1);
  fail=true;clock=40000;await monitor.tick();fail=false;await monitor.tick();assert.equal(starts,1);
  snapshot={windows:[],candidates:[]};await monitor.tick();snapshot={windows:['42'],candidates:[base]};await monitor.tick();await monitor.tick();assert.equal(starts,2);monitor.close();
});
test('disabled and busy meetings never launch recording, failed starts do not loop',async()=>{
  let enabled=false,busy='meeting',starts=0,errors=0;
  const monitor=new AutoMeetingStarter({getSettings:()=>({meetingAutoStart:enabled}),busy:()=>busy,start:async()=>{starts++;throw Error('capture');},onError:()=>errors++,scan:async()=>({windows:['42'],candidates:[base]})});
  await monitor.tick();assert.equal(starts,0);enabled=true;await monitor.tick();await monitor.tick();busy=false;await monitor.tick();assert.equal(starts,0);
  monitor.seen.clear();await monitor.tick();await monitor.tick();assert.equal(starts,1);assert.equal(errors,1);monitor.close();
});
