(function(root) {
  'use strict';
  async function systemAudio(getDisplayMedia) {
    const video={width:1,height:1,frameRate:1};
    try { return await getDisplayMedia({audio:{restrictOwnAudio:true},video}); }
    catch(error) {
      // Process loopback avoids device-format failures with some USB headsets.
      // Older Windows versions may only support the ordinary endpoint loopback.
      if(!['NotReadableError','NotSupportedError','AbortError'].includes(error.name))throw error;
      return getDisplayMedia({audio:true,video});
    }
  }
  function sourceError(source,error) {
    const name=source==='mic'?'De microfoon':'Het computergeluid';
    if(error.name==='NotAllowedError')return new Error(`${name} heeft geen toestemming. Controleer de Windows-privacyinstellingen voor audio.`);
    if(source==='mic'&&['NotFoundError','OverconstrainedError'].includes(error.name))return new Error('De gekozen microfoon is niet beschikbaar. Kies een aangesloten microfoon via Instellingen → Algemeen.');
    if(source==='system')return new Error('Computergeluid kon niet starten. Controleer of je hoofdtelefoon of luidsprekers zijn aangesloten en geluid afspelen. Probeer daarna opnieuw.');
    return new Error('De microfoon kon niet starten. Controleer je aansluiting en of een andere app de microfoon exclusief gebruikt. Probeer daarna opnieuw.');
  }
  const api={systemAudio,sourceError};
  if(typeof module!=='undefined')module.exports=api;else root.captureSources=api;
})(globalThis);
