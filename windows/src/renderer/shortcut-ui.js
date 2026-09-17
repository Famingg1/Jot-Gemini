(function() {
  'use strict';
  const api=window.TakkieHotkeys, el=id=>document.getElementById(id);
  let target='hotkeys';
  const bindingsFor=()=>target==='noteHotkeys'?api.notesFromSettings(settings):api.fromSettings(settings);
  let settings, editing=false, editIndex=-1, candidate=[], held=new Set(), timeout;
  const error=message=>{el('shortcut-error').textContent=message;};
  window.renderHotkeys = value => {
    settings=value;
    const list=el('shortcut-list');list.replaceChildren();
    const bindings=api.fromSettings(settings);
    bindings.forEach((chord,index)=>{
      const row=document.createElement('div');row.className='shortcut-row';
      const label=document.createElement('kbd');label.textContent=api.label(chord);row.append(label);
      const edit=document.createElement('button');edit.type='button';edit.textContent='Wijzigen';edit.disabled=editing;edit.onclick=()=>begin(index,'hotkeys');row.append(edit);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Verwijderen';remove.disabled=editing||bindings.length===1;
      remove.onclick=async()=>{try{await window.updateSettings({hotkeys:bindings.filter((_,i)=>i!==index)});error('');}catch(e){error(e.message);}};row.append(remove);list.append(row);
    });
    el('shortcut-add').disabled=editing||bindings.length>=8;
    const notes=el('note-shortcut-list');notes.replaceChildren();api.notesFromSettings(settings).forEach((chord,index)=>{const row=document.createElement('div');row.className='shortcut-row';const label=document.createElement('kbd');label.textContent=api.label(chord);const button=document.createElement('button');button.type='button';button.textContent='Wijzigen';button.disabled=editing;button.onclick=()=>begin(index,'noteHotkeys');row.append(label,button);notes.append(row);});
  };
  async function begin(index=-1,kind='hotkeys') {
    error('');target=kind;
    try {await window.jot.recordShortcut(true);}catch(e){error(e.message);return;}
    editing=true;editIndex=index;candidate=[];held.clear();
    el('shortcut-recorder').hidden=false;el('shortcut-save').disabled=true;
    el('shortcut-preview').textContent='Druk je combinatie in, laat los en klik op Opslaan. Esc annuleert.';
    window.renderHotkeys(settings);
    clearTimeout(timeout);timeout=setTimeout(()=>{cancel();error('Opnemen gestopt. Klik opnieuw op Sneltoets opnemen.');},29000);
  }
  async function cancel() {
    if(!editing)return;
    editing=false;clearTimeout(timeout);held.clear();el('shortcut-recorder').hidden=true;
    await window.jot.recordShortcut(false).catch(()=>{});window.renderHotkeys(settings);
  }
  function key(event) {
    if(!editing)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.code==='Escape'){cancel();return;}
    if(event.type==='keyup'){held.delete(event.code);return;}
    if(event.repeat)return;
    if(!Object.hasOwn(api.keys,event.code)){error('Deze toets wordt nog niet ondersteund.');return;}
    if(held.size===0)candidate=[];
    held.add(event.code);candidate=[...held];
    el('shortcut-preview').textContent=api.label(candidate);el('shortcut-save').disabled=false;error('');
  }
  document.addEventListener('keydown',key,true);document.addEventListener('keyup',key,true);
  window.addEventListener('blur',cancel);
  el('settings-dialog').addEventListener('close',cancel);
  const noteGroup=document.createElement('div');noteGroup.innerHTML='<h4>Notetaker</h4><p>Open een nieuwe meeting. Tijdens een opname opent dit het compacte venster.</p><div id="note-shortcut-list"></div>';el('shortcut-list').parentElement.insertBefore(noteGroup,el('shortcut-recorder'));
  el('shortcut-add').onclick=()=>begin();el('shortcut-cancel').onclick=cancel;
  el('shortcut-save').onclick=async()=>{
    try {
      const bindings=bindingsFor().map(c=>[...c]);
      if(editIndex<0)bindings.push(candidate);else bindings[editIndex]=candidate;
      const clean=api.validate(bindings);
      const combined={...settings,[target]:clean};api.validateGroups(api.fromSettings(combined),api.notesFromSettings(combined));await window.updateSettings({[target]:clean});await cancel();error('');
    }catch(e){error(e.message);}
  };
})();
