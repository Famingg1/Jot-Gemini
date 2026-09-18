'use strict';
const $ = id => document.getElementById(id);
let meeting, dirty = false, timer, pendingSave = Promise.resolve(), busy = false, revision = 0;
const request = async (action, value) => { try { return await window.meetingPanel.action(action, value); } catch (error) { throw Error(error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); } };
const fail = error => { $('error').hidden = false; $('error').textContent = error.message; };
window.flushMeetingNotes = () => {
  clearTimeout(timer);
  if (!dirty || !meeting) return pendingSave;
  const text = $('notes').value, currentRevision = revision;
  dirty = false;
  pendingSave = pendingSave.catch(() => {}).then(() => request('notes', text)).then(() => { if (revision === currentRevision) $('saved').textContent = 'Lokaal opgeslagen'; }).catch(error => { dirty = true; $('saved').textContent = 'Opslaan mislukt'; fail(error); throw error; });
  return pendingSave;
};
$('notes').oninput = () => { dirty = true; revision++; $('saved').textContent = 'Opslaan…'; clearTimeout(timer); timer = setTimeout(() => window.flushMeetingNotes().catch(() => {}), 250); };
for (const tab of ['notes','transcript','summary']) $('tab-'+tab).onclick = () => { for (const name of ['notes','transcript','summary']) { $('tab-'+name).setAttribute('aria-selected', String(name === tab)); $(name+'-panel').hidden = name !== tab; } };
const paragraph = (parent, text, tag = 'p') => { const element = document.createElement(tag); element.textContent = text; parent.append(element); };
async function refresh() {
  const value = await request('get');
  const switched = meeting?.id !== value.id; meeting = value;
  $('title').textContent = value.title;
  $('detected-call').hidden=!value.detectedProvider||!['recording','paused'].includes(value.state);$('detected-call').textContent=({meet:'Google Meet',teams:'Teams',zoom:'Zoom',whatsapp:'WhatsApp'}[value.detectedProvider]||'Meeting')+' gedetecteerd — opname gestart';
  if (switched || (!dirty && document.activeElement !== $('notes'))) $('notes').value = value.notes;
  const recording = ['recording','paused'].includes(value.state);
  $('pause').hidden = !recording; $('stop').hidden = !recording;
  $('pause').textContent = value.state === 'paused' ? 'Hervatten' : 'Pauzeren';
  $('generate').hidden = recording || !['saved','ready'].includes(value.state) || !value.manifest.sources.mix?.samples || Boolean(value.summary && !value.error);
  $('generate').textContent = value.error ? 'Opnieuw verwerken' : 'Samenvatting maken';
  $('status').textContent = ({recording:'● Opname actief',paused:'Opname gepauzeerd',finalizing:'Audio opslaan…',saved:'Audio lokaal opgeslagen',transcribing:'Transcript maken…',summarizing:'Samenvatting maken…',ready:'Lokaal opgeslagen'})[value.state] || 'Even wachten…';
  if (value.error) fail(Error(value.error.message || String(value.error))); else if (!dirty) $('error').hidden = true;
  $('transcript').replaceChildren();
  const segments=recording?[]:value.transcript.segments;
  $('transcript-empty').textContent=recording?'Je audio wordt lokaal opgenomen. Na stoppen verschijnen je transcript en samenvatting.':'Het transcript verschijnt na verwerking van je opname.';
  $('transcript-empty').hidden = segments.length > 0;
  for (const segment of segments) {
    const heading=document.createElement('div');heading.className='speaker-heading';
    const name=document.createElement('button');name.className='speaker-label';name.textContent=window.TakkieSpeakers.label(value,segment.speakerId);
    name.onclick=()=>{const edit=document.createElement('input');edit.value=name.textContent;edit.setAttribute('aria-label','Sprekernaam');edit.setAttribute('list','participant-names');name.replaceWith(edit);edit.focus();edit.select();const commit=async()=>{try{await request('speaker',{id:segment.speakerId,name:edit.value});await refresh();}catch(error){fail(error);}};edit.onchange=commit;edit.onkeydown=event=>{if(event.key==='Enter')edit.blur();};};
    const time=document.createElement('small');time.textContent=Math.floor(segment.startMs/60000)+':'+String(Math.floor(segment.startMs/1000)%60).padStart(2,'0');heading.append(name,time);$('transcript').append(heading);paragraph($('transcript'),segment.text);
  }
  let names=$('participant-names');if(!names){names=document.createElement('datalist');names.id='participant-names';document.body.append(names);}names.replaceChildren();for(const person of value.participants||[]){const option=document.createElement('option');option.value=person.name||person.email;names.append(option);}
  $('summary').replaceChildren(); $('summary-empty').hidden = Boolean(value.summary);
  if (value.summary) { paragraph($('summary'),value.summary.summary || ''); for (const [key,label] of [['decisions','Besluiten'],['actions','Actiepunten']]) { if (value.summary[key]?.length) { paragraph($('summary'),label,'h2'); for (const item of value.summary[key]) paragraph($('summary'),typeof item === 'string' ? item : [item.text,item.owner,item.deadline].filter(Boolean).join(' · ')); } } }
}
async function act(action) { if (busy) return; busy = true; for (const id of ['pause','stop','generate']) $(id).disabled = true; try { await window.flushMeetingNotes(); await request(action); await refresh(); } catch(error) { fail(error); } finally { busy=false; for (const id of ['pause','stop','generate']) $(id).disabled=false; } }
$('pause').onclick = () => act(meeting?.state === 'paused' ? 'resume' : 'pause');
$('stop').onclick = () => act('stop'); $('generate').onclick = () => act('retry');
window.meetingPanel.onChanged(() => refresh().catch(fail));
window.meetingPanel.onClose(async () => { try { await window.flushMeetingNotes(); await request('hide'); } catch(error) { fail(error); } });
window.meetingPanel.onLevels(value => { if (meeting?.state === 'recording') $('status').textContent = '● Opname actief · '+Math.floor(value.durationMs/60000)+':'+String(Math.floor(value.durationMs/1000)%60).padStart(2,'0'); });
refresh().catch(fail);
