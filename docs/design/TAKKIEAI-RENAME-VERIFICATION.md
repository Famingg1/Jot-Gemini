# TakkieAI — naamswijziging

17 september 2026. De Windows-app heet op verzoek TakkieAI.

- Zichtbare naam gewijzigd in interface, onboarding, venstertitels, HUD, systeemvak, meldingen, exports en MCP-beschrijvingen.
- Windows productnaam, executable, installer en snelkoppelingsnaam gewijzigd naar TakkieAI.
- Interne package-, installatie- en protocolidentiteiten behouden voor compatibiliteit. Bestaande gegevens worden niet gewist of bewust verplaatst. De oorspronkelijke repositorynaam en helperbestandsnaam blijven technische identifiers.
- Installer: `windows/dist/TakkieAI-0.4.0-Windows-x64.exe`.
- Directe executable: `windows/dist/win-unpacked/TakkieAI.exe`.

Verificatie volgens de oplevering-skill: build geslaagd, 40 tests groen, encodingcontrole zonder hits. De daadwerkelijk gebouwde TakkieAI.exe is gestart met een geïsoleerd profiel. Smoketest geslaagd met nul consolefouten: CRUD, lokale MCP, opname, playback en recorder-crashherstel. Screenshots op desktop en 375px bekeken; de nieuwe naam past in de zijbalk en er is geen horizontale overflow. Bewijs: `windows/screenshots/takkieai/smoke.json` en de bijbehorende PNG-bestanden. Webserver/poortcontrole is niet van toepassing op deze Electron-app. Deze naamswijziging introduceert geen nieuwe auth- of datamutaties; eerdere privacy- en foutafhandeling blijven gelden.

Deze verificatie betreft de naamswijziging. De open live-provider-, hardware- en sneltoetshelpercontroles uit `NOTETAKER-VERIFICATION.md` zijn hiermee niet afgetekend.
