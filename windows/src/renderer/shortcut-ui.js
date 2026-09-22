(function() {
  'use strict';
  const api=window.TakkieHotkeys, el=id=>document.getElementById(id);
  const svg=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const icons={pencil:svg('<path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17z"/><path d="M13.5 6.5l3 3"/>'),trash:svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),plus:svg('<path d="M12 5v14M5 12h14"/>'),check:svg('<path d="M5 12.5l4.5 4.5L19 7"/>'),close:svg('<path d="M6 6l12 12M18 6L6 18"/>')};
  // Chips: one per key, Windows as a symbol and left/right as a small suffix.
  const chip=code=>{const kbd=document.createElement('kbd');const side=/Left$/.test(code)?'L':/Right$/.test(code)?'R':'';const base=code.startsWith('Meta')?'⊞ Win':/^(Control|Alt|Shift)/.test(code)?code.replace(/Left|Right/,'').replace('Control','Ctrl'):(api.keys[code]?.[1]||code);kbd.textContent=base;if(side){const s=document.createElement('small');s.textContent=side;kbd.append(s);}return kbd;};
  const keys=(container,chord)=>{container.replaceChildren();chord.forEach((code,i)=>{if(i){const plus=document.createElement('i');plus.textContent='+';container.append(plus);}container.append(chip(code));});};
  let settings, editing=false, editIndex=-1, target='hotkeys', candidate=[], held=new Set(), timeout;
  const error=message=>{el('shortcut-error').textContent=message;};
  const iconButton=(name,label,cls='')=>{const b=document.createElement('button');b.type='button';b.className='slot-icon '+cls;b.innerHTML=icons[name];b.setAttribute('aria-label',label);return b;};
  el('shortcut-save').innerHTML=icons.check;el('shortcut-cancel').innerHTML=icons.close;
  window.renderHotkeys = value => {
    settings=value;
    const recorder=el('shortcut-recorder');
    for(const kind of ['hotkeys','noteHotkeys']){
      const list=el(kind==='hotkeys'?'shortcut-list':'note-shortcut-list');list.replaceChildren();
      const bindings=kind==='hotkeys'?api.fromSettings(settings):api.notesFromSettings(settings);
      bindings.forEach((chord,index)=>{
        if(editing&&target===kind&&editIndex===index){list.append(recorder);return;}
        const slot=document.createElement('div');slot.className='shortcut-slot';const span=document.createElement('span');span.className='slot-keys';keys(span,chord);slot.append(span);
        const actions=document.createElement('span');actions.className='slot-actions';
        const edit=iconButton('pencil','Sneltoets wijzigen');edit.disabled=editing;edit.onclick=()=>begin(index,kind);actions.append(edit);
        if(kind==='hotkeys'&&bindings.length>1){const remove=iconButton('trash','Sneltoets verwijderen');remove.disabled=editing;remove.onclick=async()=>{try{await window.updateSettings({hotkeys:bindings.filter((_,i)=>i!==index)});error('');}catch(e){error(e.message);}};actions.append(remove);}
        slot.append(actions);list.append(slot);
      });
      if(kind==='hotkeys'){
        if(editing&&target===kind&&editIndex<0)list.append(recorder);
        const add=document.createElement('button');add.type='button';add.id='shortcut-add';add.className='shortcut-add';add.innerHTML=icons.plus;add.setAttribute('aria-label','Sneltoets toevoegen');add.disabled=editing||bindings.length>=8;add.onclick=()=>begin(-1,'hotkeys');list.append(add);
      }
    }
    if(!editing){recorder.hidden=true;el('shortcut-panel').append(recorder);}
    el('shortcut-reset').disabled=editing;
  };
  async function begin(index=-1,kind='hotkeys') {
    error('');target=kind;
    try {await window.jot.recordShortcut(true);}catch(e){error(e.message);return;}
    editing=true;editIndex=index;candidate=[];held.clear();
    const recorder=el('shortcut-recorder');recorder.hidden=false;el('shortcut-save').disabled=true;
    el('shortcut-preview').replaceChildren();preview();
    window.renderHotkeys(settings);
    clearTimeout(timeout);timeout=setTimeout(()=>{cancel();error('Opnemen gestopt. Klik opnieuw op het potlood of de plus.');},29000);
  }
  function preview(){const box=el('shortcut-preview');if(candidate.length){keys(box,candidate);return;}box.replaceChildren();const hint=document.createElement('span');hint.className='slot-placeholder';hint.textContent='Druk je combinatie in…';box.append(hint);}
  async function cancel() {
    if(!editing)return;
    editing=false;clearTimeout(timeout);held.clear();candidate=[];
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
    preview();el('shortcut-save').disabled=false;error('');
  }
  document.addEventListener('keydown',key,true);document.addEventListener('keyup',key,true);
  window.addEventListener('blur',cancel);
  el('settings-dialog').addEventListener('close',cancel);
  el('shortcut-cancel').onclick=cancel;
  el('shortcut-save').onclick=async()=>{
    try {
      const bindings=(target==='noteHotkeys'?api.notesFromSettings(settings):api.fromSettings(settings)).map(c=>[...c]);
      if(editIndex<0)bindings.push(candidate);else bindings[editIndex]=candidate;
      const clean=api.validate(bindings);
      const combined={...settings,[target]:clean};api.validateGroups(api.fromSettings(combined),api.notesFromSettings(combined));await window.updateSettings({[target]:clean});await cancel();error('');
    }catch(e){error(e.message);}
  };
  el('shortcut-reset').onclick=async()=>{
    const hotkeys=[['ControlRight']];
    if(!await window.confirmDialog('Sneltoetsen terugzetten naar rechter Ctrl voor dictatie en F9 voor Notetaker?',{confirmLabel:'Herstellen',danger:false}))return;
    try{await window.updateSettings({hotkeys,noteHotkeys:api.notesFromSettings({hotkeys})});error('');}catch(e){error(e.message);}
  };
})();
