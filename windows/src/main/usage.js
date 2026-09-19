'use strict';
const fs = require('node:fs');
const path = require('node:path');
const monthOf = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : null; };
class Usage {
  constructor(root) {
    this.file=path.join(root,'monthly-usage.json');
    try { this.data=JSON.parse(fs.readFileSync(this.file,'utf8')); if(this.data.version!==1||!this.data.records||!this.data.costs)throw Error('Invalid usage'); }
    catch(error) { if(error.code!=='ENOENT'){this.error=true;return;} this.data={version:1,since:new Date().toISOString(),records:{},costs:{}}; this.persist(); }
  }
  persist(){if(this.error)return;try{require('./storage').atomicWriteJson(this.file,this.data);}catch{this.error=true;}}
  recording(kind,meta){
    if(this.error||!meta?.id||['recording','preparing','paused','finalizing','cancelled'].includes(meta.state||meta.status))return;
    const ms=kind==='meeting'?meta.durationMs:meta.durationSeconds*1000, month=monthOf(meta.startedAt);
    if(!month||!Number.isFinite(ms)||ms<=0)return;
    const key=kind+':'+meta.id, value={month,kind,ms};
    if(JSON.stringify(this.data.records[key])===JSON.stringify(value))return;
    this.data.records[key]=value;this.persist();
  }
  audio(model,ms,at=new Date()){
    if(this.error||!Number.isFinite(ms)||ms<=0)return;
    const month=monthOf(at);if(!month)return;
    const item=this.data.costs[month]||{usd:0,requests:0,unpriced:0,audioMs:0};
    item.requests++;item.audioMs+=ms;
    // Google's blended estimate, 2026-09-18. Unknown models are never priced as zero.
    // ElevenLabs Scribe v2 API list price 2026-09-19: $0.22 per hour.
    if(model==='gemini-3.5-transcribe')item.usd+=blended(ms);else if(model==='scribe_v2')item.usd+=ms/3600000*.22;else item.unpriced++;
    this.data.costs[month]=item;this.persist();
  }
  // Replaces the blended estimate of one attempt by the token-metered price once the response is in.
  settle(model,usage,ms,at=new Date()){
    if(this.error||model!=='gemini-3.5-transcribe')return;
    const tokens=tokenCounts(usage);if(!tokens)return;
    const month=monthOf(at);const item=this.data.costs[month];if(!month||!item)return;
    // List price 2026-09-16: $2.00 per 1M audio input tokens, $12.00 per 1M text output tokens.
    item.usd+=tokens.input*2/1e6+tokens.output*12/1e6-blended(ms);item.metered=(item.metered||0)+1;
    this.data.costs[month]=item;this.persist();
  }
  snapshot(month=monthOf(new Date())){
    if(this.error)throw Error('Je lokale gebruiksoverzicht kon niet worden gelezen of opgeslagen.');
    if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Ongeldige maand.');
    const result={month,since:this.data.since,dictationMs:0,meetingMs:0,dictations:0,meetings:0,cost:this.data.costs[month]||{usd:0,requests:0,unpriced:0,audioMs:0}};
    for(const r of Object.values(this.data.records))if(r.month===month){result[r.kind==='meeting'?'meetingMs':'dictationMs']+=r.ms;result[r.kind==='meeting'?'meetings':'dictations']++;}
    result.months=[...new Set([monthOf(new Date()),...Object.values(this.data.records).map(r=>r.month),...Object.keys(this.data.costs)])].sort().reverse();return result;
  }
}
const blended=ms=>ms/60000*.005;
function tokenCounts(usage){
  if(!usage||typeof usage!=='object')return null;
  const sum=list=>Array.isArray(list)?list.reduce((total,item)=>total+(Number(item?.tokens)||0),0):null;
  const input=Number.isFinite(usage.total_input_tokens)?usage.total_input_tokens:Number.isFinite(usage.promptTokenCount)?usage.promptTokenCount:sum(usage.input_tokens_by_modality);
  const output=Number.isFinite(usage.total_output_tokens)?usage.total_output_tokens:Number.isFinite(usage.candidatesTokenCount)?usage.candidatesTokenCount:sum(usage.output_tokens_by_modality);
  return Number.isFinite(input)&&Number.isFinite(output)&&input>=0&&output>=0?{input,output}:null;
}
module.exports={Usage,monthOf,tokenCounts};
