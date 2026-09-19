# TakkieAI 0.4.15 — altijd invoegen op de huidige cursor

De native helper vergeleek bij het plakken het actuele voorgrondvenster met het venster-handle dat bij het indrukken van de sneltoets was vastgelegd. Week dat handle af (ander venster, browser-popup, HUD-start met verouderd doel), dan weigerde de helper met `target-changed` en belandde het transcript op het klembord met de melding "Gekopieerd — druk op Ctrl+V". Dat gebeurde in de praktijk ook terwijl de cursor gewoon in een tekstveld stond.

De venstercheck is verwijderd uit `PASTE` en `TYPE` in `windows/native/JotNativeHelper.cs`. TakkieAI voegt nu altijd in bij wat op het moment van invoegen focus heeft. `SessionManager.insert` en `NativeHelper.paste` geven geen doelvenster meer mee; het protocol is `PASTE` en `TYPE <base64>`. De beveiligd-veld detectie bij het indrukken van de sneltoets is ongewijzigd. Het klembord blijft alleen de terugval als het plakken zelf faalt (`failed`, `timeout`, helper niet beschikbaar), bijvoorbeeld bij een doel dat als administrator draait.

De Electron-smoke bevatte een stap die juist op de weigering leunde (`nativeTargetGuard`). Die stap en de bijbehorende `browserWindowHandle`-helper zijn verwijderd, omdat de capture-runner in de achtergrond draait en zonder guard in een willekeurig venster zou plakken.

Verificatie: lint en 64 unit/integratietests slagen. De unittest voor automatisch plakken controleert nu dat `paste()` zonder argumenten wordt aangeroepen en het klembord daarna hersteld wordt. Native helper opnieuw gecompileerd en NSIS-installer gebouwd als `windows/dist/TakkieAI-0.4.15-Windows-x64.exe`. Lokaal geïnstalleerd over 0.4.14 heen.

Niet getest: geautomatiseerde end-to-end plaktest in een extern venster; handmatig te bevestigen in een paar apps (browser, editor, chat) inclusief wisselen van venster tijdens het dicteren.
