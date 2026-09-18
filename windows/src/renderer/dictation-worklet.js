class DictationPCM extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Int16Array(512);this.used=0;this.ready=false;this.energy=0;this.frames=0;this.port.onmessage=event=>{if(event.data.type==='flush'){this.flush();this.port.postMessage({type:'flushed'});}};}
  flush(){if(!this.used)return;const pcm=this.buffer.slice(0,this.used);this.port.postMessage({type:'pcm',pcm:pcm.buffer},[pcm.buffer]);this.used=0;}
  process(inputs){const input=inputs[0]?.[0];if(!input?.length)return true;let energy=0;
    for(const value of input){const sample=Math.max(-1,Math.min(1,value));energy+=sample*sample;this.buffer[this.used++]=Math.round(sample*(sample<0?32768:32767));if(this.used===this.buffer.length)this.flush();}
    if(!this.ready){this.ready=true;this.port.postMessage({type:'ready'});}
    this.energy+=energy;this.frames+=input.length;if(this.frames>=512){this.port.postMessage({type:'level',rms:Math.sqrt(this.energy/this.frames)});this.energy=0;this.frames=0;}return true;
  }
}
registerProcessor('dictation-pcm',DictationPCM);
