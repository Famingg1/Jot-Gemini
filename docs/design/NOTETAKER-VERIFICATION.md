# Jot Windows 0.4 — verificatie en open eindcontrole

Datum: 17 september 2026. Dit document is een voortgangsrapport, geen verklaring dat alle eisen al bewezen zijn.

## Gebouwd

Flow-achtige Windows-interface met Notetaker als startscherm, Dictation, Insights, woordenboek, snippets, schrijfstijlen, transforms, scratchpad en instellingen. Kleine zwarte HUD met pauzeren/hervatten/afronden, optioneel grotere variant en bronstatus. Lokale meetingopslag met afzonderlijke microfoon-, systeem- en gemengde tracks, herstel en retry. Gemini-transcriptie met timestamps/sprekers, aparte samenvatting en bronverwijzingen. Google Calendar desktop-OAuth, lokale read-only MCP-server en custom MCP-connectorbeheer.

Installer: `windows/dist/Jot-0.4.0-Windows-x64.exe`. De installer is niet digitaal ondertekend. De uitgepakte applicatie staat in `windows/dist/win-unpacked/Jot.exe`.

Laatste build (14:04 UTC): alle 30 bestanden onder `windows/src` plus de smoketest byte-voor-byte vergeleken met de gebouwde app.asar, zonder verschillen. SHA-256 installer: `919AAFF816479B8596701A3D3E5D94F50B90BE3B79A5DCF2DF71064099EB0F04`.

## Bewijs per eis

| Eis | Gecontroleerd bewijs | Status |
| --- | --- | --- |
| Build + syntaxis | `npm run build`: lint, 40 tests, native compilatie, Electron packaging, NSIS geslaagd | Bewezen voor genoemde build |
| Juiste gebouwde app | Eigen `.capture-profile-packaged`, daadwerkelijke `dist/win-unpacked/Jot.exe`, screenshots en smoke.json | Bewezen |
| UI CRUD | Werkelijke rendererknoppen: notitie maken/hernoemen, dictionary, snippet, scratchpad | Bewezen |
| Draft bij navigatie | Typen → onmiddellijk navigeren → waarde in echte lokale opslag gecontroleerd | Bewezen |
| Microfoon + systeem capture | Echte Electron/Chromium-captureflow met expliciet synthetische devices; drie WAV-tracks | Bewezen voor synthetische bronnen |
| Echte Windows-loopback | 2,912s systeem-only opname van lokale testtoon, RMS 361,7, geen microfoon/upload | Bewezen op deze computer |
| Fysieke microfoon/twee stemmen | Geen echte menselijke testcall uitgevoerd | Nog te testen |
| Pauze/resume/laatste buffer | Unit tests en werkelijke Electron capture met ACK, opgeslagen audio daarna geladen | Bewezen |
| Lokaal afspelen | Eigen jot-audio-protocol levert WAV; Chromium leest juiste duur | Bewezen voor laden/decoderen |
| Crashherstel | Renderercrash behoudt audio; bovendien volledige procesboom tijdens opname geforceerd beëindigd en gebouwde app herstart: 16s op alle drie tracks hersteld, PCM-checkpoint identiek, WAV-headers kloppen, notitie zichtbaar | Bewezen voor procescrash, geen stroomuitvalclaim |
| Hoofdvenster sluiten | Tijdens opname venster gesloten; proces en alle drie tracks blijven opnemen, daarna crashherstel gecontroleerd | Bewezen |
| Duur/buffer | Gesimuleerd uur: 3 × 57.600.000 samples, 120 WAVs per bron, bounded writer | Bewezen voor opslagtest |
| Echt uur looptijd | Electron-soak afgerond: 60 min + 24 ms, 57.600.384 samples en 121 WAV-segmenten per track; mic/system/mix exact gelijk, headers en manifesttotalen gecontroleerd | Bewezen voor synthetische bronnen |
| Geheugen tijdens uurproef | Alle Electron-processen samen: begin 701,7 MiB, piek 739,6 MiB, einde 723,8 MiB | Gemeten; geen claim over onbeperkte duur |
| Hardware drift/echo/headset | Geen fysieke 60-minuten meeting of headsetwissel getest | Nog te testen |
| Offline/rate limit/auth | Mocked providerfouten, backoff, retry, cancel, delete en retention regressies | Bewezen op geautomatiseerd niveau |
| Gemini live | Parser/schema tests gebaseerd op officiële API; geen echte sleutel aanwezig in testprofiel | Nog te testen met eigen key |
| Agenda OAuth | Echte lokale HTTP callback met fake provider: PKCE/state, tokens, paging, disconnect-races | Bewezen op integratietestniveau |
| Google Calendar live | Geen desktop OAuth-client/account geconfigureerd | Nog te testen met eigen account |
| MCP | Echte SDK stdio handshake en toolcalls, private meeting geweigerd; werkt in app.asar en gebouwde Jot | Bewezen |
| Cloud-MCP clients | Geen publieke endpoint beloofd; lokaal stdio aantoonbaar beschikbaar | Buiten lokale implementatie |
| Settings + tools | Gevalideerde settings, snippets literal/boundary-test, codingprofiel, AI-transforms adapter | Lokale werking bewezen; AI-output vraagt live key |
| Light/dark/narrow | Werkelijke screenshots light/dark en 375px; nul globale horizontale overflow | Bewezen |
| Schaalfactoren | Electron smoke op 125% en 150% geslaagd, inclusief capture, MCP, crashherstel en 375px | Bewezen |
| Contrast | Secundaire tekst #68665f: 5,27:1 op #f6f5f1; focus- en foutstatussen zichtbaar | Gecontroleerd |
| Console/encoding | 0 renderer-consolefouten in smoke; geen mojibake-hits in src/scripts/test | Bewezen |
| Global push-to-talk | Native helper wordt gecompileerd maar verdwijnt/weigert starten in deze omgeving | Geblokkeerd, oorzaak extern nog niet vastgesteld |
| Gewone dictatie-invoer | Bestaande coretests + clipboard/focusguard tests; echte invoegtest door helperprobleem ontbreekt | Deels bewezen |

## Bewijsbestanden

- `windows/screenshots/release-final/smoke.json` en bijbehorende schermbeelden: volledige gebouwde-app-smoke, CRUD, MCP, capture, recovery, responsive en console (alles geslaagd, 13:55 UTC).
- `windows/screenshots/release-crash/process-crash.json`: nieuw gebouwde app, volledige procesboom geforceerd beëindigd; herstart en drie tracks gecontroleerd (14:05 UTC). Alleen de testharness veranderde sinds de volledige smoke; productiebroncode bleef gelijk.
- `windows/screenshots/process-crash/process-crash.json`: dezelfde procescrashproef op de ontwikkelversie.
- `windows/screenshots/flow-light/`: lichte screenshotvergelijking en synthetische dual-source smoke.
- `windows/screenshots/loopback/system-loopback.json`: echte Windows-loopback, zonder upload.
- `windows/screenshots/dpi125/smoke.json`: schaalfactor 125%.
- `windows/screenshots/dpi150/smoke.json`: schaalfactor 150%.
- `windows/screenshots/soak/soak.json`: succesvolle uurproef, afgerond 14:43:53 UTC. `soak-progress.json` bevat de tussentijdse metingen; het veld `finished:false` daarin is een tussentijdse snapshot en niet de terminale uitslag.
- `windows/screenshots/soak/soak-audit.json`: onafhankelijke controle van alle afgesloten WAV-bestanden, sampleaantallen en manifesten via `node scripts/verify-soak.js` (14:44 UTC). Geen audio geüpload; fysieke microfoon en hardwaredrift vallen buiten deze synthetische proef.
- `windows/test/core.test.js`, `meeting.test.js`, `integrations.test.js`, `text-tools.test.js`: regressies op opslag, contracten, auth en verwerking.

Testprofielen staan uitsluitend onder `windows/.capture-profile-*`; synthetische testopnames worden niet als persoonlijke productiedata gebruikt. De tests gebruiken geen Gemini-key en uploaden geen audio.

## Veiligheid en herstel

Main-process IPC controleert afzender en hoofdframe. Meeting-ID's, brontracks, segmentnummers en instellingen worden gevalideerd. Geheimen zitten buiten renderer/settings-JSON. AI-resultaten worden als tekst/data behandeld. De MCP-server geeft alleen expliciet gedeelde notities vrij. Filesystemexports gebruiken een gebruikersgekozen doel. Stop en foutpaden bewaren bestaande segmenten; verwijderde AI-jobs kunnen geen meetings terug aanmaken.

De sneltoetshelper-fout wordt nu zichtbaar getoond in de app en leidt niet meer tot een vastgelopen opstart. Handmatige opnameknoppen blijven beschikbaar. Er is geen beveiligingssoftware uitgeschakeld of omzeild. Controle van de Windows-beveiligingsgeschiedenis/endpointbescherming is nodig om het verdwijnen van het helperbestand te verklaren.

## Nog nodig voor volledige oplevering

1. Eigen Gemini-key lokaal invoeren en een bekende Nederlandstalige/tweetalige testmeeting end-to-end controleren, inclusief samenvatting/actiepunten en providerfouten.
2. Google Desktop OAuth-client lokaal instellen en de echte eigen agenda verbinden, vernieuwen, herstarten en ontkoppelen.
3. Native helper beschikbaar krijgen zonder beveiligingsinstellingen te omzeilen; daarna echte global-hotkey/foreground-insertion regressie.
4. Fysieke microfoon, hoofdtelefoonwissel, echte lange meeting/echo en Windows slaapstand op het doelapparaat controleren.

De volledige goal blijft open zolang deze relevante eindcontroles ontbreken.
