'use strict';
// Explicit local hardware check: plays quiet test tones, never uploads audio.
// Run from windows/: node scripts/verify-desktop-audio.js [--packaged]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process');
const {pcmToWav}=require('../src/main/wav');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const root=path.resolve('.capture-profile-desktop-verification-'+Date.now()),children=[];fs.mkdirSync(root,{recursive:true});
// Measure short windows independently: pause/resume introduces phase jumps that
// cancel a coherent Fourier sum over the entire saved recording.
function amplitude(pcm,hz){const values=[];for(let offset=0;offset+16000<=pcm.length;offset+=16000){let re=0,im=0;for(let n=0;n<8000;n++){const value=pcm.readInt16LE(offset+n*2);re+=value*Math.cos(2*Math.PI*hz*n/16000);im+=value*Math.sin(2*Math.PI*hz*n/16000);}values.push(Math.hypot(re,im)/8000*2);}values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)]||0;}
async function play(name,hz){const pcm=Buffer.alloc(32000);for(let n=0;n<16000;n++)pcm.writeInt16LE(Math.round(400*Math.sin(2*Math.PI*hz*n/16000)),n*2);const wave=path.join(root,hz+'.wav');fs.writeFileSync(wave,pcmToWav(pcm,16000));const exe=path.join(root,name+'.exe');fs.copyFileSync(path.join(root,'TonePlayer.exe'),exe);const child=spawn(exe,[wave],{windowsHide:true});children.push(child);await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.on('error',reject);});}
async function run(){
 const source=path.resolve('test/fixtures/TonePlayer.cs');execFileSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:exe','/out:'+path.join(root,'TonePlayer.exe'),source],{windowsHide:true});
 let helper;
 try{
   await play('msedge',440);await play('Spotify',1200);await play('AppleMusic',1600);await play('Music.UI',2000);
   const packaged=process.argv.includes('--packaged');
   const output=path.resolve('screenshots',packaged?'desktop-filter-packaged':'desktop-filter-dev');fs.mkdirSync(output,{recursive:true});
   const exe=path.resolve(packaged?'dist/win-unpacked/TakkieAI.exe':'node_modules/electron/dist/electron.exe');
   helper=spawn(exe,packaged?[]:['.'],{windowsHide:true,env:{...process.env,JOT_SMOKE:'1',JOT_TEST_PROFILE:path.join(root,'app'),JOT_CAPTURE_DIR:output,JOT_SYSTEM_TEST:'1',JOT_PANEL_TEST:'1'}});
   const exit=new Promise((resolve,reject)=>{helper.once('error',reject);helper.once('exit',code=>code===0?resolve():reject(Error('App smoke failed with '+code)));});
   const out=fs.createWriteStream(path.join(output,'app.log'));helper.stdout.pipe(out);helper.stderr.pipe(out,{end:false});
   await sleep(2200);await play('opera',660);await play('Music',2400);await exit;
   const report=JSON.parse(fs.readFileSync(path.join(output,'panel.json'),'utf8'));assert.equal(report.ok,true,JSON.stringify(report.errors));
   const meetings=path.join(root,'app/meetings'),id=fs.readdirSync(meetings).find(id=>fs.existsSync(path.join(meetings,id,'audio/system/000000.wav')));
   const pcm=fs.readFileSync(path.join(meetings,id,'audio/system/000000.wav')).subarray(44+16000*2);assert.ok(pcm.length>16000*2);
   const amplitudes=Object.fromEntries([440,660,1200,1600,2000,2400].map(hz=>[hz,amplitude(pcm,hz)]));
   assert.ok(amplitudes[440]>50,'Edge is audible in saved app recording');assert.ok(amplitudes[660]>50,'New Opera app is audible');
   // Other permitted apps may play speech during this test. Require no excluded
   // narrowband peak above adjacent noise, and <25% of the allowed reference.
   const adjacentNoise={};for(const hz of [1200,1600,2000,2400]){adjacentNoise[hz]=Math.max(...[-20,-10,10,20].map(delta=>amplitude(pcm,hz+delta)));assert.ok(amplitudes[hz]<Math.max(5,3*adjacentNoise[hz])&&amplitudes[hz]<Math.min(amplitudes[440],amplitudes[660])*.25,'Excluded music tone detected or background too loud: '+hz);}
   const result={ok:true,packaged,amplitudes,adjacentNoise,flows:report.flows,profile:root,uploaded:false};fs.writeFileSync(path.join(output,'audio-verification.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{for(const child of children)if(child.exitCode===null)child.kill();if(helper?.exitCode===null)helper.kill();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
