# TakkieAI 0.4.11 — automatische herkenning van gesprekken

Scope: automatische start uitsluitend voor Google Meet, Teams, Zoom en WhatsApp. Geen generieke microfoon- of computer-audiotrigger; games en Discord starten geen opname. Handmatig starten blijft mogelijk.

## Trigger en gedrag

Een apart lokaal Windows UI Automation-proces inspecteert ondersteunde appvensters. In browsers vereist herkenning een ondersteund domein in de adresbalk plus zichtbare actieve-gespreksknoppen (verlaten/ophangen én microfoon). Voor native Teams/Zoom/WhatsApp zijn zowel de procesnaam als gespreksknoppen vereist. Nederlands/Engels. Twee positieve scans, normaal circa 5–10 seconden, starten één opname. Time-outs starten niets. Het venster tonen of in een lobby staan is onvoldoende. Stilte of een gedempte microfoon verhindert herkenning niet.

Een herkende opname gebruikt gerichte audio van het gedetecteerde proces, plus de ingestelde microfoon. Andere apps worden niet via de volledige desktopmix toegevoegd. Audio uit andere tabbladen van dezelfde browser kan wel meekomen. De handmatige audiovoorkeur wordt niet overschreven. De match met een Google Calendar-afspraak gebeurt via de meeting-URL; de agenda alleen start geen opname op een tijdstip.

Na succesvolle start verschijnt een Windows-melding (afhankelijk van OS-meldingsinstellingen) en een blijvende gedetecteerd-melding in het compacte venster. Handmatig stoppen onderdrukt opnieuw starten voor dezelfde herkenning. De opname wordt niet automatisch beëindigd: de gebruiker rondt die zelf af. Dit voorkomt stoppen door tabwissels of ontbrekende toegankelijkheidsdata.

## Verificatie en beperkingen

- Unit tests: domein/proces-whitelist, Discord/games, lobby, Nederlandse/Engelse labels, twee scans, niet opnieuw starten na handmatige stop, scan-time-out, busy en foutafhandeling.
- Native Windows-test met echte toegankelijke testvensters: lobby genegeerd, actieve gespreksknoppen herkend. `node scripts/verify-meeting-detector.js`.
- Volledige build en bestaande meeting/audio/HUD-regressietests. Instellingen-smoke en screenshot in `windows/screenshots/auto-pack0411`.
- Geen echte Google Meet-, Teams-, Zoom- of WhatsApp-call end-to-end getest. De native test bootst toegankelijkheidsknoppen na en bewijst niet dat elke appversie deze aanbiedt. Herkenning kan missen bij andere talen, verborgen/minimaliseerde vensters, gewijzigde labels of niet-beschikbare UI Automation. Controleer de zichtbare opname-indicator; F9 blijft de handmatige start.
- Alleen meeting-appvensters worden geïnspecteerd; geen volledige schermopnames of screenshots. Scanresultaten blijven tijdelijk in geheugen, worden niet naar Gemini gestuurd. Alleen de gestartte opname volgt de bestaande transcriptieroute.
- Detector heeft een proces-time-out van 8 seconden en een gebonden uitvoerbuffer; geen parallelle scans. De native helper staat expliciet in de Windows package allowlist.
- Standaard uit voor andere installaties; op deze pc aanzetten is expliciet door gebruiker gevraagd. Opstarten met Windows wordt niet stilzwijgend veranderd.

Bron voor UI Automation-aanpak: https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.automationelement.findall. Geen nieuwe cloudintegratie, OAuth of bot nodig voor deze lokale herkenning.
