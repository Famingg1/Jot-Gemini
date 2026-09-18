/* global AudioWorkletProcessor, registerProcessor, sampleRate */
'use strict';
class MeetingPCM extends AudioWorkletProcessor {
  constructor(options) {
    super(); this.enabled = options.processorOptions.sources; this.buffers = [new Int16Array(8000), new Int16Array(8000), new Int16Array(8000)]; this.used = 0; this.offset = 0; this.sequence = 0; this.phase = 0; this.sums = [0,0]; this.count = 0; this.peaks = [0,0];
    this.nativeSystem=Boolean(options.processorOptions.nativeSystem);this.nativeQueue=[];this.nativeIndex=0;this.nativeSamples=0;this.visualSamples=0;this.visualEnergy=[0,0];this.readySent=false;
    this.micDelay=new Float32Array(this.enabled[0] ? Math.max(0,Math.min(3200,options.processorOptions.nativeLatency||0)) : 0);this.micDelayIndex=0;this.micDelayPending=false;
    this.port.onmessage = event => { if(event.data.type==='native'){const pcm=new Int16Array(event.data.pcm);if(pcm.length)this.nativeQueue.push(pcm);this.nativeSamples+=pcm.length;if(this.nativeSamples>32000){this.port.postMessage({type:'fault',message:'De app-audio kon niet bijblijven; opname gestopt.'});this.nativeQueue=[];this.nativeSamples=0;this.nativeIndex=0;}} if (event.data.type === 'flush') { this.drainNative(); this.flush(); this.port.postMessage({ type: 'flushed', token: event.data.token }); } };
  }
  drainNative() {
    let remaining=Math.max(this.nativeSamples,this.micDelayPending?this.micDelay.length:0);this.micDelayPending=false;
    while(remaining-->0){let b=0,a=0;if(this.nativeQueue.length){const head=this.nativeQueue[0];b=head[this.nativeIndex++];this.nativeSamples--;if(this.nativeIndex>=head.length){this.nativeQueue.shift();this.nativeIndex=0;}}if(this.micDelay.length){a=Math.round(this.micDelay[this.micDelayIndex]*32767);this.micDelay[this.micDelayIndex]=0;this.micDelayIndex=(this.micDelayIndex+1)%this.micDelay.length;}this.buffers[0][this.used]=a;this.buffers[1][this.used]=b;this.buffers[2][this.used]=Math.max(-32768,Math.min(32767,Math.round((a+b)*(this.enabled[0]&&this.enabled[1]?0.5:1))));this.used++;if(this.used===8000)this.flush();}
  }
  flush() {
    if (!this.used) return;
    for (let n = 0; n < 3; n++) if (n === 2 || this.enabled[n]) { const pcm = this.buffers[n].slice(0,this.used); this.port.postMessage({ type: 'chunk', source: ['mic','system','mix'][n], sequence: this.sequence, sampleOffset: this.offset, pcm: pcm.buffer }, [pcm.buffer]); }
    this.port.postMessage({ type: 'levels', mic: this.peaks[0], system: this.peaks[1], durationMs: (this.offset + this.used) / 16 }); this.offset += this.used; this.used = 0; this.sequence++; this.peaks = [0,0];
  }
  process(inputs) {
    if(!this.readySent&&(!this.enabled[0]||inputs[0]?.[0]?.length)){this.readySent=true;this.port.postMessage({type:'ready'});}
    const frames = inputs[0]?.[0]?.length || inputs[1]?.[0]?.length || 128;
    for (let i = 0; i < frames; i++) {
      const values = [0,0];
      for (let n = 0; n < 2; n++) { const channels = inputs[n] || []; for (const channel of channels) values[n] += channel[i] || 0; values[n] /= channels.length || 1; this.peaks[n] = Math.max(this.peaks[n], Math.abs(values[n])); this.sums[n] += values[n]; }
      this.count++; this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate; let a = this.sums[0]/this.count, b = this.sums[1]/this.count;
        if(this.micDelay.length){const previous=this.micDelay[this.micDelayIndex];this.micDelay[this.micDelayIndex]=a;this.micDelayIndex=(this.micDelayIndex+1)%this.micDelay.length;a=previous;this.micDelayPending=true;}
        if(this.nativeSystem){b=0;if(this.nativeQueue.length){const head=this.nativeQueue[0];b=head[this.nativeIndex++]/32768;this.nativeSamples--;if(this.nativeIndex>=head.length){this.nativeQueue.shift();this.nativeIndex=0;}}this.peaks[1]=Math.max(this.peaks[1],Math.abs(b));}
        const scale = this.enabled[0] && this.enabled[1] ? 0.5 : 1;
        for (let n = 0; n < 3; n++) this.buffers[n][this.used] = Math.round(Math.max(-1,Math.min(1,[a,b,(a+b)*scale][n])) * 32767);
        this.visualEnergy[0]+=a*a;this.visualEnergy[1]+=b*b;this.visualSamples++;
        if(this.visualSamples>=800){const level=n=>Math.max(0,Math.min(1,(20*Math.log10(Math.max(Math.sqrt(this.visualEnergy[n]/this.visualSamples),.00001))+55)/45));this.port.postMessage({type:'visual-level',level:Math.max(level(0),level(1))});this.visualSamples=0;this.visualEnergy=[0,0];}
        this.sums = [0,0]; this.count = 0; this.used++; if (this.used === 8000) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('meeting-pcm', MeetingPCM);
