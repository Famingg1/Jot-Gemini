'use strict';
const {execFile}=require('node:child_process');
const path=require('node:path');
function recognize(candidate){
  const process=String(candidate.process||'').toLowerCase();let provider,host='';
  if(['chrome','msedge','brave','opera'].includes(process)){
    try{host=new URL(candidate.url.startsWith('https://')?candidate.url:'https://'+candidate.url).hostname;}catch{return null;}
    provider=host==='meet.google.com'?'meet':['teams.microsoft.com','teams.live.com'].includes(host)?'teams':host==='zoom.us'||host.endsWith('.zoom.us')?'zoom':host==='web.whatsapp.com'?'whatsapp':null;
  }else provider=['teams','ms-teams'].includes(process)?'teams':process==='zoom'?'zoom':process==='whatsapp'?'whatsapp':null;
  if(!provider||!Number.isSafeInteger(candidate.pid)||candidate.pid<=0)return null;
  const buttons=(candidate.buttons||[]).map(s=>String(s).toLowerCase().trim());
  const leave=buttons.some(s=>/^(leave( (call|meeting))?|gesprek verlaten|vergadering verlaten|verlaten|end call|end meeting|hang up|ophangen|oproep beëindigen|gesprek beëindigen|de oproep verlaten)(\s*\([^)]*\))?$/.test(s));
  const mic=buttons.some(s=>/^(mute|unmute|microfoon|dempen|dempen opheffen|turn (on|off) microphone|microphone|mic(?:\s|$))/.test(s));
  if(!leave||!mic)return null;
  return {...candidate,provider,key:candidate.window+':'+provider+':'+(candidate.url||candidate.title),audioApp:process==='msedge'?'edge':process==='ms-teams'?'teams':process};
}
class AutoMeetingStarter {
  constructor({getSettings,start,busy,onError=()=>{},scan,now=()=>Date.now()}){Object.assign(this,{getSettings,start,busy,onError,scan,now});this.seen=new Map();this.hits=new Map();this.running=false;}
  async tick(){
    if(this.running||!this.getSettings().meetingAutoStart)return;
    this.running=true;
    try{
      const snapshot=await this.scan();if(this.closed||!this.getSettings().meetingAutoStart)return;
      const windows=new Set(snapshot.windows);for(const [key,value]of this.seen)if(!windows.has(value.window)&&this.now()-value.at>30000)this.seen.delete(key);
      const recognized=snapshot.candidates.map(recognize).filter(Boolean);const next=new Map();
      for(const call of recognized){const count=(this.hits.get(call.key)||0)+1;next.set(call.key,count);if(count<2||this.seen.has(call.key))continue;
        const busy=this.busy();if(busy){if(busy==='meeting')this.seen.set(call.key,{window:call.window,at:this.now()});continue;}
        this.seen.set(call.key,{window:call.window,at:this.now()});
        try{await this.start(call);}catch(error){this.onError(error);}
        break;
      }this.hits=next;
    }catch{ /* Unknown detector state never starts recording or rearms a stopped call. */ }
    finally{this.running=false;}
  }
  close(){this.closed=true;clearInterval(this.timer);}
}
function startAutoMeetings(options){
  const {app}=require('electron');
  const executable=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked/native/bin/TakkieMeetingDetector.exe'):path.join(app.getAppPath(),'native/bin/TakkieMeetingDetector.exe');
  const scan=()=>new Promise((resolve,reject)=>execFile(executable,[],{windowsHide:true,timeout:8000,maxBuffer:512*1024},(error,stdout)=>{if(error)return reject(error);try{resolve(JSON.parse(stdout));}catch(error){reject(error);}}));
  const monitor=new AutoMeetingStarter({...options,scan});monitor.timer=setInterval(()=>monitor.tick(),5000);monitor.timer.unref();return monitor;
}
module.exports={recognize,AutoMeetingStarter,startAutoMeetings};
