# TakkieAI 0.4.17 — HUD: geen "Handsfree"-tekst, groene golfvorm bij meetings

Bij hover over de pill in handsfree dictatie verscheen de tekst "Handsfree" naast de timer. Dat label is leeg gemaakt, net als bij gewoon luisteren; de pill toont bij hover nu alleen de timer en de golfvorm. De tooltip valt terug op "TakkieAI".

Tijdens een meetingopname (`recording` en `paused`) is de golfvorm nu mintgroen (`#34d399`) in plaats van wit, zodat in één oogopslag zichtbaar is dat er een meeting wordt opgenomen en niet een dictatie. De golfvorm blijft live meebewegen met het geluidsniveau; gepauzeerd blijft gedempt zoals voorheen. Het merkpalet bevat geen groen, dus dit is een bewuste signaalkleur.

Verificatie: lint en 69 tests slagen; geen logicawijziging, alleen `windows/src/renderer/hud.js` (label) en `windows/src/renderer/hud.css` (kleur). NSIS-installer gebouwd als `windows/dist/TakkieAI-0.4.17-Windows-x64.exe` en lokaal geïnstalleerd over 0.4.16 heen.

Niet getest: visuele controle op een echt scherm tijdens een meeting; handmatig te bevestigen door een meetingopname te starten en de HUD te bekijken.
