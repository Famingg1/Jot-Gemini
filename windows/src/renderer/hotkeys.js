(function(root) {
  'use strict';
  const keys = {ControlLeft:[162,'Linker Ctrl'],ControlRight:[163,'Rechter Ctrl'],AltLeft:[164,'Linker Alt'],AltRight:[165,'Rechter Alt'],ShiftLeft:[160,'Linker Shift'],ShiftRight:[161,'Rechter Shift'],MetaLeft:[91,'Linker Win'],MetaRight:[92,'Rechter Win'],CapsLock:[20,'Caps Lock'],Space:[32,'Spatie'],Tab:[9,'Tab'],Enter:[13,'Enter'],ArrowUp:[38,'Omhoog'],ArrowDown:[40,'Omlaag'],ArrowLeft:[37,'Links'],ArrowRight:[39,'Rechts']};
  for(let i=65;i<=90;i++)keys['Key'+String.fromCharCode(i)]=[i,String.fromCharCode(i)];
  for(let i=0;i<10;i++)keys['Digit'+i]=[48+i,String(i)];
  for(let i=1;i<=24;i++)keys['F'+i]=[111+i,'F'+i];
  const modifier = code => /^(Control|Alt|Shift|Meta)/.test(code);
  const label = chord => chord.map(code=>keys[code]?.[1]||code).join(' + ');
  function validate(value) {
    if(!Array.isArray(value)||value.length<1||value.length>8)throw Error('Kies één tot acht sneltoetsen.');
    const result=value.map(chord=>{
      if(!Array.isArray(chord)||chord.length<1||chord.length>4||chord.some(c=>!Object.hasOwn(keys,c)))throw Error('Gebruik maximaal vier ondersteunde toetsen per combinatie.');
      const clean=[...new Set(chord)].sort((a,b)=>Number(modifier(b))-Number(modifier(a))||keys[a][0]-keys[b][0]);
      if(clean.some(c=>/^Key|^Digit|^Arrow|Space|Tab|Enter/.test(c))&&!clean.some(modifier))throw Error('Combineer letters en gewone toetsen met Ctrl, Alt, Shift of Windows.');
      if(clean.some(c=>c.startsWith('Alt'))&&clean.includes('F4') || clean.some(c=>c.startsWith('Meta'))&&clean.includes('KeyL'))throw Error('Deze combinatie is gereserveerd door Windows.');
      return clean;
    });
    for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)if(result[i].every(k=>result[j].includes(k))||result[j].every(k=>result[i].includes(k)))throw Error('Deze sneltoetsen overlappen. Verwijder of wijzig eerst de kortere combinatie.');
    return result;
  }
  const fromSettings = s => s.hotkeys?.length ? s.hotkeys : [[{'right-control':'ControlRight','caps-lock':'CapsLock',f8:'F8'}[s.hotkey]||'ControlRight']];
  const api={keys,label,validate,fromSettings,serialize:value=>validate(value).map(chord=>chord.map(c=>keys[c][0]).join('+')).join(';')};
  if(typeof module!=='undefined')module.exports=api;else root.TakkieHotkeys=api;
})(globalThis);
