'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process');
const {recognize}=require('../src/main/meeting-detection');
const root=path.resolve('.capture-profile-meeting-detector');fs.mkdirSync(root,{recursive:true});
const exe=path.join(root,'chrome.exe');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 execFileSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:winexe','/reference:System.Windows.Forms.dll','/out:'+exe,path.resolve('test/fixtures/MeetingDetectorWindow.cs')],{windowsHide:true});
 for(const prejoin of [true,false]){
  const child=spawn(exe,prejoin?['prejoin']:[],{windowsHide:false});
  try{await sleep(1200);const snapshot=JSON.parse(execFileSync('native/bin/TakkieMeetingDetector.exe',[],{windowsHide:true,timeout:15000,encoding:'utf8'}));const candidate=snapshot.candidates.find(x=>x.pid===child.pid);assert.ok(candidate,'Fixture accessibility controls found');assert.equal(Boolean(recognize(candidate)),!prejoin);}
  finally{child.kill();await sleep(200);}
 }
 console.log(JSON.stringify({ok:true,nativeUIAutomation:true,waitingRoomIgnored:true,joinedCallRecognized:true}));
}
run().catch(error=>{console.error(error);process.exitCode=1;});
