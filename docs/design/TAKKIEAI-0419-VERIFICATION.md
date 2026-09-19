# TakkieAI 0.4.19 — compacte hover-staat van de HUD

Bij hover over de pill tijdens opname groeide hij naar 230px met veel lege ruimte, en onder de pill verscheen de native browser-tooltip "TakkieAI". De hover-staat is nu compact: 138px met annuleerknop, timer (tabular, 26px breed), golfvorm (maximaal 46px) en klaarknop. Dit geldt voor `listening`, `locked`, `recording` en `paused`. Berichtstaten (transcriberen, gekopieerd, geannuleerd) houden hun bestaande breedte; de aparte hover-regel die het bericht daar verkleinde is verwijderd.

Native tooltips op de pill en op de annuleer- en klaarknop zijn verwijderd (geen `title` meer; `aria-label` blijft). De tooltips op de idle-strip (Dictatie, Notetaker met sneltoets) staan nog, omdat die daar de enige uitleg zijn.

Verificatie: HUD-markup en -stijlen gerenderd in een Playwright-harnas met gestubde preload-API. Schermafbeeldingen onder `windows/screenshots/hud-hover-listening-2.png` (hover tijdens opname) en `windows/screenshots/hud-cancelled-undo.png` (geannuleerd met "Ongedaan maken", 240px, past binnen het 260px HUD-venster). Console zonder fouten uit HUD-code. Lint en 73 tests slagen. NSIS-installer gebouwd als `windows/dist/TakkieAI-0.4.19-Windows-x64.exe` en lokaal geïnstalleerd over 0.4.18 heen.

Niet getest: hover in de echte Electron-HUD op meerdere schermschalen; handmatig te bekijken tijdens een dictatie.
