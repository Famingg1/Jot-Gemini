# TakkieAI 0.4.21 — pill sluit om de tekst

Berichtstaten van de HUD (Transcriberen, Gekopieerd, Geannuleerd, fouten, beveiligd veld) hadden een vaste breedte van 190px, en 240px met de knop "Ongedaan maken", terwijl de tekst zelf vaak maar 80px breed is. Dat gaf brede zwarte vlakken links en rechts van de tekst. De pill sluit nu om de inhoud: `width:auto`, padding 14px, gap 8px, maximaal 250px zodat hij binnen het HUD-venster van 260px blijft. De hover-verbreding naar 230px voor berichtstaten is vervallen; opnamestaten houden hun eigen compacte hover van 138px uit 0.4.19.

Gemeten in het Playwright-harnas met de echte HUD-markup: Transcriberen 103px, Geannuleerd met Ongedaan maken 202px, Gekopieerd met Plakken 237px (de breedste staat, past). Schermafbeeldingen: `windows/screenshots/hud-processing-tight.png` en `windows/screenshots/hud-clipboard-tight.png`.

Verificatie: alleen `windows/src/renderer/hud.css` gewijzigd; lint en 79 tests slagen. NSIS-installer gebouwd als `windows/dist/TakkieAI-0.4.21-Windows-x64.exe` en lokaal geïnstalleerd over 0.4.20 heen.

Niet getest: foutmeldingen langer dan circa 200 tekens worden afgekapt met een ellipsis op 250px; dat gedrag is ongewijzigd ten opzichte van de vaste breedte.
