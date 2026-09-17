# TakkieAI 0.4.6 — meetingvenster en gerichte audio

## Gedrag

Nieuwe opname biedt Google Meet (Chrome), Microsoft Teams, Zoom en expliciet Alle computergeluiden. De laatst gekozen bron wordt onthouden; eerste standaard is Chrome. Een Windows process-loopback-helper neemt alleen het gekozen proces en zijn kinderen op. Er is geen stille terugval naar alle apps. Spotify in een aparte app wordt uitgesloten; Spotify in dezelfde Chrome-browser wordt meegenomen. Windows build 20348 of hoger is nodig voor gerichte audio.

Na succesvol starten opent een zelfstandig venster met Eigen notities, Transcript en Samenvatting. Notities worden lokaal opgeslagen. Sluiten verbergt het venster zonder de opname te stoppen. Heropenen kan via Compact venster in de meeting. Pauzeren, hervatten en afronden gebruiken dezelfde recorder als het hoofdvenster. Transcript en samenvatting worden na afronden verwerkt; live transcriptie is niet toegevoegd.

De eerdere hardwarefout op Logitech PRO X werd veroorzaakt door de endpoint-loopbackroute. Alle computergeluiden gebruikt nu waar ondersteund Electron process loopback via restrictOwnAudio; alleen bij een niet-ondersteunde/onleesbare bron volgt de oudere route. Toestemmingsweigering krijgt geen fallback.

## Verificatie

- Build: lint en 47 tests geslaagd, inclusief bewaakte native audiobuffer, laatste PCM-samples en bestaande gesimuleerde uurproef.
- Werkelijke Windows process-loopback-isolatietest: twee gelijktijdige externe apps met 440 en 880 Hz. Gekozen toon amplitude 494,03; uitgesloten toon 0,093 (minder dan 0,02%). Bewijs: windows/screenshots/native-isolation.json. Geen audio geüpload.
- Echte microfoon plus Chrome-proces: starten, pauzeren, hervatten en stoppen; onafhankelijke mic/system-tracks opgeslagen.
- Venster: lokale notities, sluiten tijdens opname, heropenen, drie tabs, lokale resultaatfixtures, lege en foutstatus, breedte 375px zonder horizontale overflow. Geen consolefouten. Bewijs: windows/screenshots/panel046b/panel.json en schermbeelden.
- IPC van het paneel is beperkt tot het eigen webContents/hoofdframe en gekoppelde meeting-ID. Er wordt geen willekeurige PID vanuit de renderer geaccepteerd. Bronkeuzes worden gevalideerd; notities en AI-uitvoer worden als tekst gerenderd.
- Native bronfouten stoppen de opname en behouden reeds opgeslagen audio.
- Gebouwde 0.4.6: dezelfde paneelflow geslaagd met echte microfoon en Chrome (4236 ms, twee tracks), nul consolefouten: windows/screenshots/panel-pack046/panel.json. Alle 42 bronbestanden en beide native helpers bytegewijs vergeleken met het pakket; identiek. Encodingcontrole schoon.

## Grenzen

Geen echte Teams-/Zoom-call uitgevoerd; Windows-procesisolatie en Chrome-capture zijn wel op dit apparaat getest. Geen Gemini-aanroep uitgevoerd in deze tests; de werkende persoonlijke sleutel is niet veranderd. Google Calendar OAuth blijft apart te configureren. Geen nieuwe duurproef met fysieke hardware van een uur; de PCM-/opslagregressie gebruikt gesimuleerde audio.
