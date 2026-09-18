'use strict';
window.TakkieAudioRecorder=class AudioRecorder {
  constructor(){this.stream=null;this.context=null;this.capture=false;this.levelHandler=null;this.generation=0;}
  abortStart(){this.generation++;}
  async start({deviceId='default',capture=true,levelHandler=null,sessionId=null}={}){
    await this.stop();const generation=++this.generation;
    const audio={channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false};if(deviceId&&deviceId!=='default')audio.deviceId={exact:deviceId};
    const stream=await navigator.mediaDevices.getUserMedia({audio,video:false});
    if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
    this.stream=stream;this.context=new AudioContext({sampleRate:16000,latencyHint:'interactive'});
    await this.context.audioWorklet.addModule('dictation-worklet.js');
    if(generation!==this.generation){await this.stop();return;}
    this.capture=capture;this.levelHandler=levelHandler;this.sessionId=sessionId;
    this.source=this.context.createMediaStreamSource(stream);this.node=new AudioWorkletNode(this.context,'dictation-pcm');
    this.node.port.onmessage=event=>{const value=event.data;
      if(value.type==='ready'&&generation===this.generation&&capture)window.jot.audioStatus(sessionId,'ready');
      if(value.type==='pcm'&&this.capture)window.jot.audioChunk(value.pcm,this.context.sampleRate,sessionId);
      if(value.type==='level'){const level=Math.min(1,Math.max(0,(20*Math.log10(Math.max(value.rms,.00001))+55)/45));this.levelHandler?.(level);window.jot.audioLevel(level);}
      if(value.type==='flushed')this.flushed?.();
    };
    this.node.onprocessorerror=()=>window.jot.audioStatus(sessionId,'error');
    this.source.connect(this.node);this.node.connect(this.context.destination);await this.context.resume();
  }
  async stop(){
    if(!this.stream)return;
    const context=this.context;
    try{if(this.node){await context.suspend();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Laatste audio kon niet worden bevestigd.')),2000);this.flushed=()=>{clearTimeout(timer);resolve();};this.node.port.postMessage({type:'flush'});});}}
    finally{this.capture=false;this.node?.disconnect();this.source?.disconnect();this.stream.getTracks().forEach(track=>track.stop());await context?.close().catch(()=>{});this.stream=null;this.context=null;this.node=null;this.source=null;this.levelHandler?.(0);this.levelHandler=null;}
  }
};
