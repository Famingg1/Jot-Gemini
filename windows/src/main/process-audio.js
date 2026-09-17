'use strict';
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
const {app}=require('electron');
const executable=()=>app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/native/bin/TakkieProcessAudio.exe'):path.join(app.getAppPath(),'native/bin/TakkieProcessAudio.exe');
async function listAudioApps(){const {stdout}=await promisify(execFile)(executable(),['--list'],{windowsHide:true,timeout:10000});return JSON.parse(stdout);}
async function startProcessAudio(kind,onData,onFault){
  if(!['desktop-filtered','chrome','teams','zoom'].includes(kind))throw Error('Kies een geldige audiobron.');
  const candidates=kind==='desktop-filtered'?[{pid:'--desktop-filtered'}]:(await listAudioApps()).filter(a=>a.app===kind);
  if(!candidates.length)throw Error('Open eerst '+({chrome:'Chrome met je meeting',teams:'Microsoft Teams',zoom:'Zoom'}[kind])+'.');
  if(candidates.length>1)throw Error('Er zijn meerdere processen met een venster voor deze app. Sluit de extra appvensters en probeer opnieuw.');
  return new Promise((resolve,reject)=>{
    const child=spawn(executable(),[String(candidates[0].pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let pending='',ready=false,closing=false;
    const waits=new Map();
    const sendCommand=(command,ack)=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{waits.delete(ack);reject(Error('De audiorecorder reageert niet op '+command.toLowerCase()+'.'));},5000);waits.set(ack,{resolve:()=>{clearTimeout(timeout);resolve();},reject:error=>{clearTimeout(timeout);reject(error);}});child.stdin.write(command+'\n');});
    const timer=setTimeout(()=>{closing=true;child.kill();reject(Error('De audio van de meeting-app reageert niet.'));},12000);
    const control={pause:()=>sendCommand('PAUSE','paused'),resume:()=>sendCommand('RESUME','resumed'),finish:async()=>{await sendCommand('STOP','stopped');closing=true;},stop:()=>{closing=true;clearTimeout(timer);child.stdin.end('STOP\n');setTimeout(()=>{if(child.exitCode===null)child.kill();},1000).unref();}};
    child.stdin.on('error',()=>{});
    child.stderr.resume();
    child.on('error',()=>{clearTimeout(timer);reject(Error('De gerichte audio-helper is niet beschikbaar. Installeer TakkieAI opnieuw.'));});
    child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{
      pending+=chunk;if(pending.length>1024*1024){control.stop();onFault('De audiobuffer is te groot geworden.');return;}
      const lines=pending.split(/\r?\n/);pending=lines.pop();
      for(const line of lines){if(!line)continue;try{const value=JSON.parse(line);if(waits.has(value.type)){waits.get(value.type).resolve();waits.delete(value.type);}else if(value.type==='ready'){ready=true;clearTimeout(timer);resolve(control);}else if(value.type==='pcm'&&ready&&!closing)onData(Buffer.from(value.data,'base64'));}catch{control.stop();onFault('Ongeldige data van de audio-helper.');}}
    });
    child.on('exit',code=>{clearTimeout(timer);for(const wait of waits.values())wait.reject(Error('De audio-helper is gestopt.'));waits.clear();if(!ready)reject(Error('App-audio kon niet starten. Windows 10 build 20348 of hoger is vereist.'));else if(!closing)onFault('De audio-opname is onderbroken. De opgeslagen audio is bewaard.');});
  });
}
module.exports={startProcessAudio,listAudioApps};
