# Jot Windows — Flow-interface en lokale meetingnotetaker

Datum: 17 september 2026. Status: uitvoerbaar bouwplan; nog niet geïmplementeerd.

## Doel en uitgangspunten

Fahim wil zijn bestaande Windows-dictatieapp gebruiken als persoonlijke Wispr Flow-achtige tool met eigen API-key. Hoogste prioriteit: meetings opnemen met microfoon én computergeluid, automatisch transcriberen en samenvatten, lokaal terugvinden en via MCP kunnen raadplegen. Google Kalender is door Fahim bevestigd als eerste agendakoppeling.

De zes aangeleverde screenshots zijn de visuele bron: dezelfde rustige lichte werkruimte, navigatie, instellingenindeling en bijzonder kleine zwarte opnamebalk. Deze opdracht vervangt voor dit werk de eerdere Google-kleurkeuzes en anti-imitatierichting in PRODUCT.md en DESIGN.md. Bij implementatie beide documenten aanpassen aan de nieuwe richting. Jot blijft voorlopig de applicatienaam. Layout en bediening zo nauwkeurig mogelijk reconstrueren; fonts en beeldmateriaal alleen exact overnemen wanneer de daadwerkelijke bestanden beschikbaar zijn. Niet claimen dat onbekende schermen of verborgen Flow-functies exact zijn gereconstrueerd.

Geen Wispr-abonnement of kunstmatige woordlimiet. Gemini-verbruik via de eigen key kan wel kosten hebben. Audio, transcripties en notities krijgen een lokale hoofdopslag; audio gaat voor transcriptie naar Google. Agenda lezen en expliciet aangevraagde MCP-antwoorden zijn eveneens externe gegevensuitwisseling. Dit is geen volledig offline AI-oplossing.

## Wat al bestaat — gecontroleerd in de code

| Onderdeel | Huidige situatie | Gebruik in dit project |
| --- | --- | --- |
| Windows-app | Electron 44, gewone HTML/CSS/JS, kleine C#-helper | Behouden; geen frameworkmigratie |
| Dictatie | Microfoon via getUserMedia, PCM naar main process, Gemini-transcriptie | Bestaande werking behouden |
| Opnameherstel | PCM en metadata per dictaat, herstel bij herstart | Patroon uitbreiden voor meetings |
| Sleutels | Electron safeStorage, versleutelde Gemini-key | Ook toepassen op OAuth-tokens en connectorgeheimen |
| Opslag | JSON en audiobestanden onder userData | Apart meetings-domein; geen Supabase nodig |
| HUD | Eigen niet-focusnemend venster, huidige actieve balk circa 244 × 48 | Verkleinen naar screenshotverhoudingen |
| UI | Geschiedenis, woordenboek, instellingen, onboarding | Nieuwe appindeling rondom bestaande functionaliteit |
| Nog te bouwen | Meetingopname, systeemgeluid, agenda, notities, MCP, codingprofielen | Nieuwe modules |

Belangrijke beperking: session-manager.js leest bij afronden het volledige PCM-bestand in het geheugen en schrijft synchroon. Dat pad niet ongewijzigd inzetten voor meetings van een uur. gemini.js geeft nu alleen platte tekst terug; timestamps en sprekersegmenten vragen een aparte adapter. De dictatiemodus mag meetingnotities nooit automatisch in het actieve venster plakken.

## Opleveringen en tijdsindeling

Richtdoel met twee gelijktijdige bouwsporen: 4–6 uur voor een intern bruikbare notetaker-kern. Dit is een inschatting, geen garantie. Google OAuth-configuratie, daadwerkelijke modeltoegang en audioapparaten kunnen de doorlooptijd verlengen. Een volledige kloon met alle extra pagina's en alle connectoren past niet geloofwaardig in diezelfde tijd.

| Tijdvak | Goh — opname en integraties | Astra — interface en interactie | Controlepunt |
| --- | --- | --- | --- |
| 0:00–0:30 | Microfoon + loopback bewijzen met lokaal afspeelbare proefopname | Screenshots meten, tokens en schermstructuur vastleggen | Beide geluidsbronnen afzonderlijk hoorbaar |
| 0:30–2:00 | Meetingopslag, chunkwriter, stop/flush, herstel | App-shell, Notetaker-overzicht, detailpagina, compacte HUD | Starten → opnemen → stoppen → lokaal afspelen |
| 2:00–3:30 | Transcriptiesegmenten, samenvatting, retryqueue | Transcriptie, samenvatting, actiepunten, opname- en foutstatussen | Echte meetingtest met twee stemmen |
| 3:30–4:30 | Google Kalender OAuth en ophalen/verversen | Agenda- en instellingenstaten op echte data aansluiten | Na herstart nog gekoppeld; afspraak start opname |
| 4:30–6:00 | Lokale MCP-basis indien kern groen; integratie en regressies | Visuele vergelijking, DPI, toetsenbord, herstel-UX | Windows-installatie en acceptatietests |

Na uur 4 expliciet de stand bepalen. Als audio/herstel nog faalt, heeft dat voorrang op MCP en extra pagina's. Agenda blijft onderdeel van de beoogde eerste versie, maar een ontbrekende OAuth-configuratie blokkeert geen losse meetingopname. Een onvolledige integratie wordt als onvolledig gerapporteerd.

Vervolgblok, grove extra inschatting 3–6 uur: codingprofielen, uitgebreid MCP-beheer, snippets, styles, transforms, scratchpad, uitgebreidere inzichten en client-specifieke connectorcontroles. Volledige visuele finetuning kan extra tijd vragen.

## Afbakening eerste bruikbare versie

- Meeting handmatig starten, ook zonder agenda; titel vooraf of achteraf aanpassen.
- Microfoon plus systeemgeluid standaard aan, ieder afzonderlijk te testen en uit te zetten.
- Pauzeren, hervatten, afronden; sluiten van het hoofdvenster onderbreekt niet.
- Zichtbare opname-indicator, timer bij uitklappen en bronstatussen.
- Audio direct lokaal bewaren; hervatbare transcriptieverwerking na fout/herstart.
- Nederlands/Engels, transcript met timestamps, corrigeerbare sprekerlabels.
- Samenvatting, besluiten en actiepunten; eigen notities blijven bewerkbaar.
- Google Kalender verbinden, verversen, komende meetings tonen en opname eraan koppelen.
- Zoeken, openen, hernoemen, exporteren als Markdown/TXT/JSON en verwijderen.
- Algemene, systeem-, notetaker-, API- en privacyinstellingen daadwerkelijk werkend.
- Bestaande dictatie, woordenboek, sneltoetsen en invoegen blijven werken.

Geen automatische deelnamebot, cloudsync, teams of betaaladministratie. De promotie- en upgradevakken uit Flow vervallen; de ruimteverdeling blijft vergelijkbaar. Automatisch beginnen met opnemen op basis van de agenda staat standaard uit. Geen verzonnen statistieken of dode knoppen om visuele volledigheid te suggereren.

## Visuele specificatie per screenshot

Fysieke gebruikssituatie: Fahim gebruikt de app overdag op een Windows-monitor naast zijn meetingvenster; het hoofdscherm is licht en rustig, alleen de kleine opnamebalk blijft zichtbaar tijdens het gesprek.

Startwaarden hieronder zijn uit de screenshots geschat. Tijdens implementatie vergelijken op dezelfde venstergrootte en Windows-schaalfactor; pixels in een screenshot zijn niet automatisch CSS-pixels.

| Element | Richting |
| --- | --- |
| App-shell | Warme bijna-witte buitenzijde rond een wit inhoudsvlak; geen blauwe Google-accenten |
| Zijbalk | Circa 208 px, lijniconen, rustige actieve rij, Settings onderaan |
| Inhoud | Circa 40 px binnenruimte, grote witte werkruimte, subtiele scheiding |
| Kleuren | Start bij #F6F5F1 buitenvlak, #FFFFFF inhoud, #EEECE5 selectie, #1B1B1A tekst, #77756F secundair, #1B6563 grafiekaccent; contrast controleren |
| Typografie | Body 14–15 px, schermtitel 24 px; serif alleen waar referentie die duidelijk gebruikt; dichtst passende beschikbare font kiezen |
| Hoeken | Hoofdvlak ongeveer 22–24 px zoals referentie; kaarten 12–16 px; knoppen 8 px |
| Schaduwen | Nauwelijks in hoofdscherm; instellingenmodal duidelijke maar beheerste schaduw |
| Animatie | Alleen toestandsfeedback, 150–200 ms; reduced-motion ondersteunen |

1. **Dictation:** welkom bovenaan, geschiedenis per dag, smalle rechterkolom met echte lokale gebruikscijfers. Geen nagemaakte betaalblokkade of fictieve streak. Aanwezige gegevens hergebruiken.
2. **Notetaker:** titel links, Nieuwe notitie en instellingen rechts; komende meetings boven, eigen notities onder als datumgroepen. Agenda leeg: verbinden-knop. Gekoppeld: volgende afspraken, tijden, bron, verversknop en laatste succesvolle synchronisatie. Promotiebanner vervangen door een compacte eerste-gebruik-uitleg die na de eerste opname verdwijnt.
3. **Insights:** dezelfde rustige tegelverhoudingen en teal-grafieken, uitsluitend lokaal meetbare cijfers. Dictatie-WPM en meetingminuten apart houden. Geen ranglijstpercentielen zonder populatiedata.
4. **Settings:** centrale modal met eigen linkerrail; Algemeen, Systeem, Notetaker, Vibe coding, Connectors, MCP en Data & privacy. API-verbruik vervangt abonnementen. Rijen met label, toelichting en rechts de instelling. Escape sluiten, focus vasthouden en terugzetten.
5. **MCP:** providerkaarten en configuratie-kopieerknoppen in dezelfde indeling; elke kaart toont ondersteunde verbindingswijze en geteste status. Geen universele 'Add to'-belofte zonder werkende clientkoppeling.
6. **Opnamebalk:** compacte zwarte capsule als referentie, startmaat ongeveer 104 × 30 CSS-px. Links kleine actie, midden witte niveaubalkjes, rechts afronden. Tijdens meetings opent de linkeractie pauze/opties; verwijderen is een afzonderlijke expliciete handeling. Dictatie houdt zijn annuleeractie. Hover/focus klapt uit voor timer, mic/systeemstatus en acties; keyboardbediening via sneltoetsen en hoofdvenster.

De kleine HUD toont een actief opnamekenmerk, geen misleidend 'online'-lampje. Offline kunnen opnemen en geen internetverbinding hebben zijn verschillende toestanden. Groen of waveform alleen is niet genoeg: tooltip/toegankelijke naam benoemt wat de app doet. De compacte maat krijgt een grotere optionele variant bij hoge DPI/toegankelijkheid. Test geen focusverlies, niet-interceptende transparante vensterranden en plaatsing op meerdere monitoren.

Niet afgebeeld maar nodig: detailpagina met bewerkbare titel, datum/duur, tabbladen Samenvatting / Transcript / Eigen notities, audioplayer, bronverwijzingen op timestamps en exportmenu. Geen alternatieve stijloefening nodig: de aangeleverde screenshots leggen de visuele richting vast.

## Opnamearchitectuur

1. Een afzonderlijke, sandboxed capture-renderer blijft actief als het hoofdvenster verborgen is. Geen microfoonopname zolang de gebruiker niet gestart heeft.
2. Microfoon via getUserMedia; Windows-systeemgeluid via Electron display-media handler met loopback. Eventueel door de API vereiste videotrack niet renderen, opslaan of uploaden. In de spike vaststellen of stoppen van de videotrack de audio intact laat.
3. Beide bronnen via AudioWorklet verwerken; afzonderlijke niveaumeters en tijdstempels. Gemeenschappelijke sampleclock, resampling en ontbrekende samples expliciet afhandelen. Microfoon en systeemgeluid als aparte brontracks bewaren, afgeleid gemengd audiospoor voor transcriptie.
4. Buffers met meetingId, source, sequence en sample-offset naar de main-process-writer. Begrensde wachtrij en backpressure; write-fouten stoppen de opname zichtbaar en bewaren het reeds geschreven deel. Geen onbegrensde audio in RAM.
5. Kleine herstelbare segmenten naar disk, bijvoorbeeld 30 seconden per bestand; periodieke flush/checkpoint. Manifest pas atomisch bijwerken nadat bijbehorende data geschreven is. Stop heeft expliciete flush-ack en finalisatie, geen gok op een vaste wachttijd.
6. App-herstart ontdekt niet-afgeronde manifests, herstelt complete segmenten en de geldige tail; toont 'Opname hersteld'. Een onderbroken opname niet stilzwijgend automatisch hervatten.
7. Transcriptiebatches bundelen uit de segmenten, startwaarde 5 minuten met kleine overlap. Definitieve batchgrootte bepalen op actuele modelgrenzen, context en gemeten kwaliteit. Bij overlap dedupliceren op tijd plus tekst, niet alleen gelijke woorden.

Standaard één actieve capture-sessie: tijdens een meeting geen tweede dictatierecorder openen. Toon dat dictatie tijdelijk bezet is. Bestaande dictatie werkt weer na beëindiging. Een losgekoppeld audioapparaat geeft bronstatus 'onderbroken', niet een blijvend bewegende nep-waveform. Bij speakers kan de microfoon dezelfde stemmen nogmaals horen; eerst testen met hoofdtelefoon, daarna echo met speakers meten. Echo-onderdrukking is geen garantie op perfecte scheiding.

Loopback omvat het gekozen systeem-uitvoerpad en kan ook meldingen/muziek bevatten. Per-app-opname is een vervolgfunctie. Als Electron-loopback op het doelapparaat niet betrouwbaar werkt, een afzonderlijke native WASAPI-route onderzoeken; dit is een scope-/tijdwijziging, geen stil aangenomen snelle fallback.

## Transcriptie en samenvatting

- Hergebruik Gemini-clientauthenticatie en foutnormalisatie; aparte meetingadapter met verbatim-transcript, timestamps en sprekerinformatie. Controleer modeltoegang met een echte korte audioaanroep.
- Mic versus systeem identificeert bronnen, niet automatisch personen. Sprekerlabels 'Spreker 1' etc. blijven corrigeerbaar. Agendadeelnemers zijn suggesties, geen bewijs van stemidentiteit. Labels over batches kunnen wisselen; alleen samenvoegen met voldoende bewijs, anders onzekere identiteit tonen.
- Sla elk succesvol batchresultaat op vóór de volgende verwerking. Retry alleen mislukte batches; limiet op parallelle requests en backoff bij 429/netwerkfouten.
- Een apart geschikt tekstmodel maakt titel, samenvatting, besluiten en actiepunten uit het transcript. Model instelbaar; definitieve keuze bij implementatie toetsen aan beschikbaarheid en kosten.
- Actiepunt = tekst, eigenaar of null, deadline of null, brontimestamps. Geen eigenaar of deadline verzinnen. Structuur valideren; mislukte samenvatting laat transcript en audio intact.
- Verbatim transcript, AI-samenvatting en eigen edits gescheiden opslaan. Opnieuw genereren overschrijft geen eigen notities. Transcriptinhoud is data, geen instructie voor connectoracties.
- Na stoppen is de opname meteen terug te vinden; AI-resultaten volgen met echte voortgang. V1 vereist geen live woord-voor-woord ondertiteling.
- Gebruik registreren waar de API dit teruggeeft; kosten alleen schatten met expliciete, dateerbare tarieven. Ontbrekende verbruiksdata betekent 'onbekend', niet €0.

## Lokale opslag en contracten

Voor de eerste interne versie aansluiten op de bestaande bestandsopslag. SQLite/FTS later bij aantoonbare zoek- of schaalbehoefte; geen onnodige migratie in het eerste bouwblok.

```text
userData/
  settings.json
  gemini-key.bin
  calendar-tokens.bin
  connectors-secrets.bin
  recordings/                 bestaande dictaten
  meetings/<uuid>/
    meta.json                 versie, titel, tijden, state, agenda-id, bronstatus
    manifest.json             segmenten, sample-offsets, verwerking, herstel
    audio/mic/*.wav
    audio/system/*.wav
    transcript.json           segment-id, start/end-ms, speaker-id, tekst, bron
    summary.json              titel, samenvatting, besluiten, acties, bron-id's
    notes.md                  eigen notities
  calendar/cache.json
  mcp/settings.json           geen geheimen
```

Renderer krijgt alleen specifieke IPC-methodes: meeting:start/pause/resume/stop, meeting:list/get/update/delete/export/retry; calendar:connect/disconnect/refresh/list; mcp:status/config. Main valideert afzender, payload, UUID en paden. Geen vrije bestandspaden of willekeurige shellcommando's vanuit renderer.

Meetingstatus: idle → preparing → recording ↔ paused → finalizing → saved → transcribing → summarizing → ready. Afzonderlijke failure/recoverymetadata; een AI-fout mag een opgeslagen opname niet als verloren markeren. UI-events: meeting:state, meeting:levels, meeting:progress, calendar:state.

Audio-retentie afzonderlijk instelbaar van notities; actieve en nog te verwerken bestanden nooit automatisch wissen. Delete bevestigt wat verwijderd wordt. Verwijderen tijdens verwerking annuleert jobs zodat resultaten niet weer terugkomen. Lokale audio/notities zijn zonder aanvullende encryptie leesbaar voor het Windows-account; alleen geheimen zijn in deze eerste versie applicatief versleuteld.

## Google Kalender

Desktop OAuth-client in een Google Cloud-project, Calendar API ingeschakeld, juiste testgebruiker/consentconfiguratie. Een Gemini API-key vervangt deze OAuth-configuratie niet. De kalenderconnector in de ontwikkelomgeving verleent de uiteindelijke Jot-app geen eigen permanente toegang.

Systeembrowser openen met state en PKCE, callback op loopback-adres, tokens beveiligd bewaren. Minimale read-only toegang tot events; calendarlist.readonly alleen toevoegen wanneer agendaselectie gebouwd wordt. Eerste versie gebruikt de primaire agenda en kijkt 14 dagen vooruit.

Ophalen met recurring instances, tijdsvolgorde, paginering en juiste tijdzone. Afgelaste afspraken uitsluiten; all-day events correct tonen. Handmatig verversen en periodiek circa elke 5 minuten als de app draait. Laatste cache blijft offline zichtbaar met tijdstip. Ontkoppelen wist lokale tokens en agenda-cache en probeert toestemming in te trekken; bestaande eigen meetingnotities blijven bestaan.

Afspraakkaart toont titel, starttijd, deelnemers waar beschikbaar, deelname-URL en 'Opnemen'. Die knop koppelt de afspraak aan de lokale opname; de app hoeft niet bij Meet/Teams/Zoom in te loggen om het Windows-geluid op te nemen. OAuth geweigerd/verlopen geeft een herstelactie. API-requests en refresh-tokens blijven buiten de renderer.

## MCP en Vibe coding

**Uitgaand: eigen notities beschikbaar maken.** Eerste stap is een lokale stdio MCP-server met list_meetings, search_meetings, get_meeting, get_transcript en get_action_items. Alleen lezen, met paginering en expliciete keuze welke meetings gedeeld mogen worden. Audio en dictaten standaard uitgesloten. Server leest atomisch opgeslagen gegevens en kan onafhankelijk van het hoofdvenster starten.

Settings → MCP biedt een kopieerbaar command/args-configuratieblok en een verbindingstest. Bewijs de werking met één lokale MCP-client. Compatibiliteit per concrete client apart controleren. Een cloudclient kan niet zomaar bij localhost; remote toegang vereist apart ontwerp, bereikbaarheid en authenticatie. Geen openbare tunnel standaard aanzetten om 'Add to ChatGPT/Gemini' te laten lijken te werken.

**Inkomend: custom MCP-servers koppelen.** Vervolgblok: naam, transport, URL óf executable/args, geheimen, testen, uitschakelen, tools inspecteren. Lokale commando's zijn expliciete gebruikersconfiguratie, nooit gegenereerd uit meetingtekst. Remote verbindingen authenticeren; writes alleen via expliciete gebruikersactie. Geen automatische tools aanroepen na transcriptie.

**Vibe coding.** Settingspagina met ontwikkelwoordenboek, voorkeur voor exact behouden van code/commando's, Nederlands/Engels en een testveld met voor/na-resultaat. Profiel eerst handmatig selecteerbaar; automatische editorherkenning later. Code en identifiers behoedzaam behandelen, geen semantische herschrijvingen of automatisch uitvoeren. Dit bouwt voort op dictatie; het is geen vervanging van de meetingnotetaker.

## Werkverdeling zonder integratieconflicten

Goh en Astra zijn hier de door Fahim genoemde uitvoerders/werksporen; dit plan hangt niet af van een specifieke modelversie. Deze planfase start nog geen bouwagents.

**Goh:** nieuwe main-modules meeting-manager.js, meeting-storage.js, meeting-transcriber.js, calendar.js en later mcp-server.js; nieuwe capture-renderer/audio-worklet. Audio- en datatests. Contracten aan het begin vastleggen.

**Astra:** renderer/index.html, styles.css, app.js en nieuwe notetaker/settingscomponenten; hud.html/css/js. Gebruik dezelfde IPC-contracten; fixtures alleen voor ontwikkeling, nooit als live data leveren.

**Integratie-eigenaar:** wijzigingen aan main/index.js, preload.js, package.json, privacydocumentatie en buildconfiguratie. Eerste 20 minuten concrete payloadschema's delen. Ieder bouwspoor eigen branch/worktree bij daadwerkelijke parallelle uitvoering; integreren per mijlpaal, niet pas helemaal aan het einde.

Handoff voor Goh: 'Bouw eerst bewijsbaar duurzame dual-source meetingcapture. Gebruik de bestaande app en dit plan; verander het dictatiepad niet onnodig. Lever capture, opslag, herstel en IPC-contract vóór AI/agenda/MCP. Rapporteer echte tests en hardwarebeperkingen.'

Handoff voor Astra: 'Reconstrueer de zes aangeleverde screenshots binnen Jot, met Notetaker als startpagina en zeer compacte zwarte HUD. Gebruik echte bron- en verwerkingsstatussen. Respecteer gedeelde IPC-contracten en laat ontbrekende integraties herkenbaar ontbreken. Lever screenshotvergelijkingen op Windows.'

## Acceptatie en oplevering

Tijdens implementatie de oplevering-skill toepassen op de relevante desktopchecks. Geen feature voltooid noemen op basis van alleen een build of een mooie screenshot.

1. Echte testcall: eigen stem én een andere stem via systeemgeluid onafhankelijk afspelen; beide terug in transcript. Test mic-only, system-only en gecombineerd.
2. Minstens 60 minuten opnemen; geen oplopende geheugenbuffer, hoorbare gaten of duidelijke drift aan begin/midden/einde. Tijdens die test UI en overige checks doen.
3. Stop tijdens spraak: laatste woorden aanwezig. Pauze/resume heeft kloppende tijdlijn. Hoofdvenster sluiten houdt opname actief.
4. Proces geforceerd stoppen tijdens opname; na herstart opgeslagen segmenten herstelbaar. Doel: bij procescrash maximaal één korte nog niet bevestigde buffer verliezen; stroomuitval apart beoordelen, geen absolute nulverliesclaim.
5. Internet uit: opname blijft lokaal werken, transcriptie wacht en kan hervatten. 401/403, 429 en samenvattingsfout bewaren de opname en tonen gerichte actie.
6. Headset loskoppelen, slaapstand en volle schijf: fout zichtbaar, reeds opgeslagen deel beschikbaar. Geen vastgelopen 'opnemen'-status.
7. Google Kalender: echte connect/refresh/disconnect, herstart, lege agenda, afgelaste/herhaalde afspraak en tijdzone.
8. MCP: gedeelde testmeeting vindbaar; niet-gedeelde meeting, API-key en audio niet opvraagbaar. Configuratie werkt in ten minste één concrete client.
9. Screenshotvergelijking op ongeveer 1366 × 900 en 100/125/150% DPI; compact venster, toetsenbord, focus, contrast, lange titels, lege/gevulde/foutstatussen. Screenshot 6 apart naast de HUD leggen.
10. Regressie: bestaande push-to-talk, lock, cancel, focusguard, woordenboek, retry en history-export. npm run lint, npm test, native build en NSIS-build. Daarna juist de gebouwde Windows-app starten en rooktest uitvoeren.

Oplevering bevat installerpad, echte screenshots, testresultaten, werkende koppelingen, bekende beperkingen en wat nog niet gebouwd is. Voor dit document zijn broncode en documentatie onderzocht; er zijn geen runtime-, audio- of integratietests uitgevoerd.

## Technische bronnen

- [Electron desktopCapturer en Windows-loopback](https://www.electronjs.org/docs/latest/api/desktop-capturer).
- [Gemini audio transcription: timestamps en diarization](https://ai.google.dev/gemini-api/docs/transcribe).
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio).
- [Google OAuth voor desktop-apps](https://developers.google.com/identity/protocols/oauth2/native-app).
- [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth).
- [MCP SDK transporten: lokaal stdio en remote HTTP](https://ts.sdk.modelcontextprotocol.io/server).

Deze bronnen onderbouwen de technische routes; zij bewijzen nog geen werking op Fahims computer. Model- en clientondersteuning tijdens implementatie opnieuw toetsen.
