# TakkieAI 0.4.10 — direct opnemen

Nieuwe opname, Opnemen bij een agenda-afspraak en de Notetaker-HUD/sneltoets starten direct met de opgeslagen audiobronnen. De bevestigingsdialoog is verwijderd. De bronkeuze staat nu bij Instellingen > Notetaker, naast Microfoon en Computergeluid. Als beide uitstaan opent die instellingenpagina met een foutmelding; er wordt geen lege opname gestart.

Een renderer-guard voorkomt dubbele startaanvragen. Tijdens een bestaande opname opent de actie het compacte venster. De bestaande main-process controle voorkomt parallelle recordings en conflicten met dictatie. Geen nieuwe IPC, netwerktoegang of credentials.

Verificatie: volledige Windows-build met 54 tests; pakketinhoud en native helpers; packaged paneltest start met één klik op de agenda-actie zonder dialoog en controleert echte opgeslagen audio, pause/resume, 375px en console. HUD-test klikt één keer op Notetaker en controleert recording plus compact window, vervolgens stoppen en keybind-opname. Screenshots en JSON: windows/screenshots/desktop-filter-packaged en windows/screenshots/hud-pack0410. Fysieke F9-keypress niet gesimuleerd; deze gebruikt dezelfde bestaande Notetaker-route.

Alleen Windows desktop; webserver/hosting en mobiele deployment zijn niet van toepassing. Audio blijft lokaal tijdens de hardware-smoketests; automatische AI-verwerking is daar uitgeschakeld. Titels en live verwerking zijn ongewijzigd ten opzichte van 0.4.9.
