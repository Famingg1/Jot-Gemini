# TakkieAI 0.4.1 — opnamebalk en updates

De opnamebalk blijft zichtbaar wanneer het hoofdvenster sluit, na een opname en na een fout. Instellingen bieden onderaan midden, midden links en midden rechts. Slepen kiest de dichtstbijzijnde positie op het scherm waar je loslaat; positie en scherm worden lokaal bewaard.

## Internetupdates

`electron-updater` controleert 15 seconden na starten en elk uur de publieke GitHub Releases van `Famingg1/Jot-Gemini`. Nieuwe stabiele versies worden automatisch gedownload en bij normaal afsluiten geïnstalleerd. Het sluiten van het hoofdvenster verbergt alleen dat venster en installeert geen update. Rechtsklikken op het systeemvakicoon toont de status en een handmatige controleknop. Offline fouten worden opgevangen; er staat geen GitHub-token in de app.

De bestaande installaties zonder updater hebben eenmalig deze installer nodig. Daarna ontvangen ze gepubliceerde hogere versies. Alleen lokaal broncode wijzigen verspreidt geen update.

`.github/workflows/windows-release.yml` bouwt bij een `v<VERSION>` tag of handmatig starten een conceptrelease. Verhoog eerst `windows/package.json` en de lockfile. Publiceer na verificatie de release met installer, blockmap en `latest.yml`. Conceptreleases gaan niet naar gebruikers. De workflow moet nog naar GitHub worden gepusht voordat hij online kan draaien.

## Verificatie

- 43 unit-/integratietests slagen, inclusief updateconcurrentie, offline afhandeling en geen geforceerde herstart.
- UI-smoke: drie HUD-posities, zichtbaar blijven, hoofdvenster sluiten, slepen zonder dictatie; geen consolefouten en geen horizontale overflow op 375 px.
- Screenshots: `windows/screenshots/hud-source042` en de uiteindelijke packaged smoke.
- De eerste sleeptest faalde; detectie gebruikt nu zowel scherm- als venstercoördinaten en onderdrukt de klik na slepen.
- Fysiek slepen over meerdere echte beeldschermen en een volledige internetupdate op een tweede pc zijn nog niet getest.
- Er is nog geen Windows-ondertekeningscertificaat ingesteld. De build maakt de installer; een signtool-logregel bewijst geen geldige digitale handtekening.

De app bewaart API-sleutels en opnames in het bestaande lokale profiel. De updater verstuurt deze niet.
