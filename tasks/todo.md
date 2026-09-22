# Windows 0.4.30: shortcuts-scherm, audio ducking, dropdowns, MCP/Vibe coding weg

Punten van Fahim (screenshot Flow + opmerking dropdown):
1. Sneltoetsen-scherm in de stijl van Flow (kaarten, toetschips, potlood, prullenbak, plus, standaard herstellen)
2. Ander geluid (muziek) stopt tijdens dictatie, instelbaar in instellingen
3. MCP uit de instellingen
4. Vibe coding uit de instellingen
5. Eigen gestylede dropdown in plaats van de native Windows select

## Taken
- [x] Native: `AudioDuck.cs` + `DUCK` commando in JotNativeHelper, build script, `native-helper.js` duck()
- [x] Main: setting `duckOtherAudio` (off/soft/mute), sanitize, defaults, hook op dictatiestatus
- [x] UI: instelling "Ander geluid tijdens dictatie" in Systeem
- [x] flow.js: MCP en Vibe coding uit rail + renderbranches + MCP-deelknop bij notitie
- [x] Shortcuts UI herbouwen (index.html, shortcut-ui.js, shortcuts.css)
- [x] Custom select (select-ui.js + css), alle selects in hoofdvenster
- [x] Tests + lint + native build + app draaien + screenshots
- [x] Versie 0.4.30, docs (WINDOWS.md + verificatienotitie), commit

## Review
- Alle vijf punten gebouwd en geverifieerd (lint, 95 tests, native build, echte duck-test, smoke-harnas tot de bestaande HUD-stap, CDP-capture donker en licht).
- Smoke-harnas faalt op `.idle-action` in de HUD; dat faalt ook op onaangeroerde 0.4.29, dus vooraf bestaand.
- Niet gebouwd: dubbel tikken voor handsfree (Flow); handsfree blijft vasthouden + Spatie.
- Versie 0.4.30 in package.json; nog niet gecommit en geen tag gepusht (tag = automatische release).
- Details: docs/design/TAKKIEAI-0430-VERIFICATION.md
