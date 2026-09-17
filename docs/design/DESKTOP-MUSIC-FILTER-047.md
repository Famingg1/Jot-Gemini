# TakkieAI 0.4.7 — alle apps behalve muziekapps

Dit vervangt het bronbeleid van 0.4.6. De standaard is nu **Alle apps, behalve muziekapps**. Opera, Edge, Brave, Chrome, Teams, Zoom en andere programma's worden opgenomen; de gebruiker hoeft niet van meeting-app te wisselen. Spotify, Music, Groove Music, Apple Music en iTunes, plus hun kindprocessen, worden overgeslagen. YouTube en andere hoorbare browsertabbladen blijven bewust inbegrepen.

## Implementatie

Windows Core Audio-sessies worden gecombineerd met vooraf geactiveerde browserprocessen. Nieuwe bronnen worden elke 250 ms ontdekt. WASAPI process-loopback neemt toegestane procesbomen afzonderlijk op; de mixer combineert PCM met Windows QPC-tijdstempels in een begrensde ringbuffer. Afstammelingen worden niet dubbel gemengd. Een bovenliggend proces dat een uitgesloten muziekproces bevat, wordt niet opgenomen om dat muziekproces niet via de achterdeur mee te nemen. TakkieAI's eigen audio wordt overgeslagen.

Bij fouten wordt niet teruggevallen op onbewerkte systeemaudio. De recorder stopt en bewaart de al ontvangen audio. Pauze en stop wachten op de native bufferbevestiging voordat de renderer zijn laatste blok opslaat. De microfoon krijgt dezelfde nominale 200 ms buffervertraging; ook die laatste samples worden geflusht. Oude bronvoorkeuren worden eenmalig naar het nieuwe standaardbeleid gemigreerd; sleutels en meetings veranderen niet.

## Verificatie

- Native test met twee toegestane processen (440/660 Hz) en uitgesloten processen onder de echte app-procesnamen (1200/1600/2000/2400 Hz). De tweede browser en Music starten tijdens de opname.
- `node scripts/verify-desktop-audio.js` test de volledige app met echte Windows-audio, fysieke microfoon en lokale PCM-bestanden. Toegestane signalen in opgeslagen systeemaudio: amplitudes 165/172; uitgesloten signalen allemaal kleiner dan 0,16. Geen upload, geen Gemini-sleutel gebruikt.
- Dezelfde flow controleert aparte vensteropening, notities opslaan, drie tabs, pauzeren, hervatten, sluiten/heropenen zonder onderbreking, afronden, resultaat-/foutfixtures, 375px zonder horizontale overflow en nul consolefouten.
- Native beleidsregressie controleert muziekprocessen, hun kinderen en bovenliggende processen, browserondersteuning en geen dubbele opname.
- Worklet-regressie controleert de gedeelde PCM-klok, begrensde backlog en behoud van laatste microfoon-/computersamples.
- Rapporten: `windows/screenshots/desktop-filter-dev/audio-verification.json`, `windows/screenshots/desktop-music-filter.json` en de schermbeelden naast de rapporten.
- Definitieve Windows-installer: build geslaagd, 49 tests geslaagd. Alle 42 verpakte bronbestanden en beide native helpers zijn identiek aan de geteste bron; encodingcontrole schoon.
- `node scripts/verify-desktop-audio.js --packaged` geslaagd: opgeslagen toegestane signalen 198/189; alle vier uitgesloten signalen kleiner dan 0,16. Paneelflow, lokale notities, pauze/hervat, veilig sluiten, 375px en nul consolefouten opnieuw bevestigd. Bewijs: `windows/screenshots/desktop-filter-packaged/audio-verification.json`.

## Grenzen en beveiliging

De uitsluiting herkent losse Windows-apps aan procesnamen en procesbomen. Muziek die in een browser wordt afgespeeld, hoort bij de browser en wordt meegenomen. Muziek die via luidsprekers hoorbaar is voor de microfoon kan via die microfoon binnenkomen. Er is geen muziekherkenningsfilter op de inhoud toegevoegd.

Tests gebruiken toonspelers met de genoemde procesnamen; er is geen Spotify-/Apple Music-account bediend. Geen echte Teams-/Zoom-call of fysieke uurmeeting getest. Nieuwe onbekende audio-apps hebben maximaal de detectie- en activeringstijd voordat hun eerste samples kunnen worden vastgelegd. Windows-systeemgeluiden zonder een toewijsbaar applicatieproces (PID 0) worden niet opgenomen. Windows process-loopback vereist build 20348 of hoger; er is geen onveilige fallback.

Paneel-IPC valideert afzender en eigen meeting-ID. De renderer kan geen willekeurige PID aanbieden en geen onbewerkte alle-apps-modus kiezen. Die oudere route blijft uitsluitend beschikbaar voor de geïsoleerde hardwaretestmodus. Dit is lokale desktopcode; webserverpoorten en browser-auth/RLS zijn niet van toepassing.

Technische API-referenties: [Microsoft process-loopback](https://learn.microsoft.com/en-us/samples/microsoft/windows-classic-samples/applicationloopbackaudio-sample/), [QPC-tijdstempels](https://learn.microsoft.com/en-us/windows/win32/api/audioclient/nf-audioclient-iaudiocaptureclient-getbuffer).
