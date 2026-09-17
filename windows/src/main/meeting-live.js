'use strict';
const WebSocket = require('ws');
class MeetingLive {
  constructor({id,apiKey,language='auto',vocabulary=[],save,onChange=()=>{},socketFactory=url=>new WebSocket(url),rotateMs=540000}) {
    Object.assign(this,{id,apiKey,language,vocabulary,save,onChange,socketFactory,rotateMs});
    this.document={segments:[],interim:'',status:'connecting',approximateTimestamps:true};this.queue=[];this.bytes=0;this.offset=0;this.lastEnd=0;this.closed=false;this.ready=false;this.attempt=0;
  }
  publish(){if(this.closed)return;try{this.save(this.document);this.onChange();}catch{this.closeNow();}}
  start(){if(!this.apiKey){this.document.status='unavailable';this.document.message='Vul je Gemini-key in voor live transcriptie.';this.publish();return;}this.connect();}
  connect(){if(this.closed)return;this.ready=false;this.document.status='connecting';this.publish();const socket=this.socketFactory('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key='+encodeURIComponent(this.apiKey));this.socket=socket;
    const timeout=setTimeout(()=>socket.close(),15000);timeout.unref?.();
    socket.on('open',()=>{if(this.closed||this.socket!==socket)return socket.close();socket.send(JSON.stringify({setup:{model:'models/gemini-3.5-transcribe-live',generationConfig:{responseModalities:['TEXT']},inputAudioTranscription:{languageCodes:this.language==='auto'?[]:[this.language],customVocabulary:this.vocabulary.slice(0,100)}}}));});
    socket.on('message',data=>{if(this.closed||this.socket!==socket)return;let value;try{value=JSON.parse(String(data));}catch{return;}
      if(value.error){this.permanent=true;this.ready=false;this.document.status='unavailable';this.document.message='Live transcriptie is niet beschikbaar met deze key of dit model. De lokale opname gaat door.';this.publish();socket.close();return;}
      if(value.setupComplete){clearTimeout(timeout);this.ready=true;this.attempt=0;this.document.status='live';delete this.document.message;this.publish();this.drain();clearTimeout(this.rotation);this.rotation=setTimeout(()=>this.rotate(),this.rotateMs);this.rotation.unref?.();}
      const content=value.serverContent;if(!content)return;
      if(content.interimInputTranscription?.text){this.document.interim=String(content.interimInputTranscription.text).slice(0,10000);this.schedulePublish();}
      if(content.inputTranscription?.text){const text=String(content.inputTranscription.text).slice(0,30000);this.document.segments.push({id:'live-'+this.document.segments.length,startMs:this.lastEnd,endMs:this.offset,text,speakerId:'live-unknown',source:'mix',speakerUncertain:true});this.lastEnd=this.offset;this.document.interim='';this.publish();}
      if(content.turnComplete)this.finishWait?.();
    });
    socket.on('error',()=>{});
    socket.on('close',()=>{clearTimeout(timeout);if(this.closed||this.socket!==socket||this.finishing||this.permanent)return;this.ready=false;this.document.status='reconnecting';this.document.message='Live verbinding onderbroken. Je opname blijft lokaal bewaard.';this.publish();this.retry=setTimeout(()=>this.connect(),Math.min(30000,1000*2**Math.min(this.attempt++,5)));this.retry.unref?.();});
  }
  schedulePublish(){if(!this.publishTimer)this.publishTimer=setTimeout(()=>{this.publishTimer=null;this.publish();},200);}
  push(payload){if(this.closed||payload.source!=='mix'||!this.apiKey)return;this.offset=(payload.sampleOffset+payload.pcm.length/2)/16;const pcm=Buffer.from(payload.pcm);for(let at=0;at<pcm.length;at+=3200){const part=pcm.subarray(at,at+3200);this.queue.push(part);this.bytes+=part.length;}while(this.bytes>320000){this.bytes-=this.queue.shift().length;this.document.hasGap=true;}this.drain();}
  drain(){if(!this.ready||this.socket?.readyState!==WebSocket.OPEN)return;while(this.queue.length){if(this.socket.bufferedAmount>320000){this.socket.close();return;}const pcm=this.queue.shift();this.bytes-=pcm.length;try{this.socket.send(JSON.stringify({realtimeInput:{audio:{data:pcm.toString('base64'),mimeType:'audio/pcm;rate=16000'}}}));}catch{this.socket.close();return;}}}
  async flush(){if(!this.ready||this.socket?.readyState!==WebSocket.OPEN)return;this.drain();await new Promise(resolve=>{const timer=setTimeout(resolve,2200);this.finishWait=()=>{clearTimeout(timer);resolve();};try{this.socket.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));}catch{clearTimeout(timer);resolve();}});this.finishWait=null;}
  async rotate(){if(this.closed||this.finishing)return;await this.flush();if(this.closed)return;this.ready=false;const old=this.socket;this.socket=null;old?.close();this.connect();}
  async finish(){if(this.closed||this.finishing)return;this.finishing=true;clearTimeout(this.retry);clearTimeout(this.rotation);await this.flush();this.document.status='finished';this.document.interim='';this.publish();this.closeNow();}
  closeNow(){this.closed=true;clearTimeout(this.retry);clearTimeout(this.rotation);clearTimeout(this.publishTimer);this.socket?.close();this.queue=[];this.bytes=0;}
}
module.exports={MeetingLive};
