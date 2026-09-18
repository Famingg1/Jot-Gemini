'use strict';
(() => {
  const $=id=>document.getElementById(id), button=$('monthly-usage-button'), panel=$('monthly-usage-panel'), month=$('usage-month'), content=$('usage-content');
  const duration=ms=>`${Math.floor(ms/3600000)} u ${Math.floor(ms/60000)%60} min`;
  const label=value=>new Date(value+'-01T12:00:00').toLocaleDateString('nl-NL',{month:'long',year:'numeric'});
  const money=value=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(value);
  let revision=0;
  async function refresh(selected=month.value||undefined){
    const request=++revision;content.setAttribute('aria-busy','true');
    try {
      const data=await window.jot.monthlyUsage(selected);if(request!==revision)return;
      // The compact header always represents the current month, independently of the picker.
      const now=new Date(),current=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const currentData=data.month===current?data:await window.jot.monthlyUsage(current);if(request!==revision)return;
      button.textContent='Deze maand · '+duration(currentData.dictationMs+currentData.meetingMs);
      month.replaceChildren();for(const value of data.months){const option=document.createElement('option');option.value=value;option.textContent=label(value);month.append(option);}month.value=data.month;
      content.replaceChildren();const list=document.createElement('dl');
      const count=n=>`${n} ${n===1?'opname':'opnames'}`;
      for(const [title,value] of [['Dictatie',`${duration(data.dictationMs)} · ${count(data.dictations)}`],['Meetings',`${duration(data.meetingMs)} · ${count(data.meetings)}`],['Transcriptiekosten sinds update',`≈ ${money(data.cost.usd)}${data.cost.unpriced?' + onbekend':''}`]]){const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=title;detail.textContent=value;list.append(term,detail);}content.append(list);
      if(!data.dictations&&!data.meetings){const empty=document.createElement('p');empty.textContent='Nog geen afgeronde opnames in deze maand.';content.append(empty);}
      const note=document.createElement('p');note.className='usage-footnote';note.textContent='Op deze pc. Je uren blijven meetellen als je een opname verwijdert.';content.append(note);
      const explanation=document.createElement('details'),summary=document.createElement('summary'),copy=document.createElement('p');explanation.className='usage-footnote';summary.textContent='Hoe worden de kosten berekend?';copy.textContent=`Oudere uren komen uit bewaarde opnames. Kostenraming vanaf ${new Date(data.since).toLocaleDateString('nl-NL')}: aangevraagde audio tegen $ 0,30 per uur voor Gemini 3.5 Transcribe (tarief 18-9-2026), geen factuur. Exclusief samenvattingen, stijl, btw en eerder live gebruik. Gratis tegoed en mislukte aanvragen kunnen de echte kosten verlagen.${data.cost.unpriced?' Voor een gebruikt model ontbreekt een tarief.':''}`;explanation.append(summary,copy);content.append(explanation);
    }catch{if(request===revision){button.textContent='Gebruik niet beschikbaar';content.textContent='Je gebruik kon niet worden geladen. Probeer opnieuw met Verversen.';}}
    finally{if(request===revision)content.removeAttribute('aria-busy');}
  }
  month.onchange=()=>refresh(month.value);$('usage-refresh').onclick=()=>refresh();
  panel.addEventListener('toggle',event=>{if(event.newState==='open')refresh();});
  window.jot.onHistoryChanged(()=>refresh());window.jot.onMeetingsChanged(()=>refresh());
  setInterval(()=>{if(!document.hidden)refresh();},30000);refresh();
})();
