# TakkieAI 0.4.13 — opnamegereedheid en golfvorm

Oorzaak: dictatie schakelde naar listening voordat getUserMedia gereed was. ScriptProcessor met 4096 samples bij 16 kHz gaf bovendien circa 256 ms tussen updates. De vaste 160 ms wachttijd bij stoppen was geen bewijs dat de laatste audio al was opgeslagen.

Wijziging: een AudioWorklet verwerkt dictatie in kleine blokken en verstuurt PCM per 512 samples (32 ms). Eerste-frame ACK activeert listening/locked; daarvoor staat er Microfoon voorbereiden. Daarna verschijnt kort Spreek nu. Een ingeschakeld startsignaal wordt pas dan afgespeeld. Stop wacht op flush ACK; sessie-IDs weigeren verouderde gereedmeldingen en audioblokken. Een stop tijdens initialisatie verhindert dat een laat geopende microfoon blijft opnemen. Startup heeft een timeout.

Meetings bevestigen eveneens de eerste worklet-cyclus voor de recording-status. De opnameopslag blijft in de bestaande blokken; visuele niveaus krijgen afzonderlijk een update per 50 ms zodat timers en opgeslagen PCM niet veranderen.

Golf: gelijke balkhoogtes met een symmetrische middenpiek, volumegestuurde drempels naar de randen en korte attack/langzamere release. Stilte valt terug tot een platte basis; geen willekeurige praatanimatie. Voorbereiden gebruikt een eigen statusindicator, geen spraakgolf. De bestaande zwarte balk en docking blijven behouden.

Verificatie: 62 unit tests, waaronder eerste-frame gereedheid, stale ACK, behoud van eerste samples en partiële laatste samples, wachten op flush, golfvorm. De speciale Electron-smoketest vertraagt getUserMedia bewust, controleert starting voor gereedheid, neemt echte synthetische browseraudio op, stopt en controleert het opgeslagen WAV-bestand. Geen opname naar Gemini verstuurd tijdens deze test. Screenshots: voorbereiding, Spreek nu, stil/midden/luid. Bestaande packaged meetingtest controleert opname, pauze/hervatten, 375px en console.

Beperking: audio van vóór het openen van het apparaat kan niet worden teruggehaald. Wacht op Spreek nu. Er wordt geen permanente achtergrondmicrofoon of preroll-buffer gestart. Internet is niet nodig voor het lokale begin van de opname; transcriptie gebruikt nog steeds Gemini.

