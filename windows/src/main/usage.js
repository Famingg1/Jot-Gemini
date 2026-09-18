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
    if(model==='gemini-3.5-transcribe')item.usd+=ms/60000*.005;else item.unpriced++;
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
module.exports={Usage,monthOf};
