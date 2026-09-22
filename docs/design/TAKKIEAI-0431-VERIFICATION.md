# TakkieAI 0.4.31 — updatemelding linksboven met één klik bijwerken

**Waarom.** Updates werden wel gedownload maar pas bij afsluiten geïnstalleerd; TakkieAI leeft in het systeemvak en wordt zelden afgesloten, dus gebruikers bleven op een oude versie hangen.

**Wat.** Zodra `electron-updater` een update heeft gedownload verschijnt linksboven in de zijbalk een knop: "Nieuwe versie klaar · Versie X is gedownload. Klik om opnieuw te starten en bij te werken · Opnieuw starten". Eén klik start de installer stil (`quitAndInstall(true, true)`), de app sluit netjes af (een lopende meeting wordt eerst afgerond via het bestaande `before-quit`-pad) en start daarna in de nieuwe versie. De knop verschijnt ook als de download klaar was voordat het venster geopend werd (`update:state` bij het laden). Het traymenu toont in die toestand "Opnieuw starten en bijwerken" in plaats van "Controleren op updates". Zonder klik verandert er niets: installeren blijft anders bij het normale afsluiten.

Bestanden: `windows/src/main/updates.js` (readyVersion, `updateState`, `installUpdate`), `windows/src/main/index.js` (`update:ready`-event, IPC `update:state` en `update:install`, `installUpdate()` zet `isQuitting`, traymenu), `windows/src/preload.js`, `windows/src/renderer/index.html`, `app.js` (`showUpdate`), `styles.css` (`.update-banner`).

Verificatie: lint; 96 tests slagen, waaronder de nieuwe in `windows/test/updates.test.js` (niets te installeren vóór een download, `readyVersion` en status na `update-downloaded`, `quitAndInstall(true, true)` precies één keer en alleen op verzoek). CDP-capture met geïsoleerd profiel: banner verborgen bij start, IPC `updateState` antwoordt, banner zichtbaar met versietekst in donker en licht thema (`windows/screenshots/update0431-cdp/`), klik zonder klaarstaande update zet de knop terug en toont een nette melding, geen console-fouten.

Niet getest: de echte herstart-naar-nieuwe-versie op deze machine (vereist een gepubliceerde volgende versie; de eerste echte proef is de update van 0.4.31 naar 0.4.32).
