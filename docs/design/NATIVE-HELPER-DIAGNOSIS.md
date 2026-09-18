# Sneltoetshelper: oorzaak vastgesteld

## Laatste status: bestand hersteld, helper draait

Na de melding van de gebruiker dat McAfee was verwijderd, bleek alleen Windows Defender geregistreerd. Het geïnstalleerde helperbestand ontbrak nog (`ENOENT`). De lokale build met de hierboven gedocumenteerde SHA-256 is naar het exacte geïnstalleerde helperpad gekopieerd. Een directe proces-/protocoltest ontving `ready`; het bestand bleef aanwezig.

Daarna gecontroleerd dat de lokale meetingstatus `ready` was en geen opname actief stond. De geïnstalleerde TakkieAI-app is opnieuw gestart. De nieuwe app-PID 46700 startte zelf helper-PID 29528 vanuit het juiste installatiepad. Daarmee is de ontbrekende-helper/startfout opgelost. De Windows Computer Use-verbinding blijft in deze sessie onbeschikbaar, dus fysieke sneltoetsen en invoegen in een gebruikersapp moeten nog interactief worden gecontroleerd. Er zijn geen antivirusuitsluitingen gemaakt of beveiligingsinstellingen gewijzigd.

De onderstaande tekst beschrijft de eerdere diagnose en herstelpoging.

17 september 2026, controle op verzoek van de gebruiker na de TakkieAI-update.

De geïnstalleerde `TakkieAI.exe` draait vanuit `C:\Users\Faming\AppData\Local\Programs\Jot\TakkieAI\`. De helper ontbreekt uit de bijbehorende `resources\app.asar.unpacked\native\bin`-map.

McAfee registreert in `C:\ProgramData\McAfee\wps\detection.log`:

- Tijd: `2026-09-17T21:42:21.004Z`.
- Bestand: `JotNativeHelper.exe` in de geïnstalleerde TakkieAI-map.
- Startend proces: de geïnstalleerde `TakkieAI.exe`.
- Detectie: `Real Protect-LS!7822496775f9`.
- Resultaat: `infection quarantined`.
- SHA-256: `515adafc86463996584ddf3d723f1b754538f1ae2f68112b24084873e357e145`.

Dezelfde hash werd bij de testbuild om 21:39:01 UTC in quarantaine gezet. Eerdere logregels verklaren ook het verdwijnen tijdens eerdere ontwikkeltests. McAfee-quarantaine is hiermee een bewezen oorzaak, niet langer alleen een hypothese. Dit bewijst niet op zichzelf dat de malwareclassificatie juist of onjuist is.

Deze controle was alleen-lezen. Geen beveiligingsinstellingen gewijzigd, uitsluitingen gemaakt of bestanden uit quarantaine teruggezet. De geïnstalleerde app en gebruikersopnames zijn niet afgesloten of gewijzigd. De update hoeft voor deze diagnose niet opnieuw uitgevoerd te worden. De helper blijft onbeschikbaar totdat deze detectie is opgelost.

## Herstelpoging op verzoek

De gebruiker heeft daarna expliciet gevraagd de blokkade te verhelpen. De volledige C#-bron is nagekeken: de helper verwerkt sneltoetsen, foreground-/passwordveldcontrole en tekstinvoer via Windows-API's; de bron bevat geen netwerkverkeer. De overgebleven lokale build in `windows/native/bin/JotNativeHelper.exe` heeft exact dezelfde SHA-256 als het in quarantaine gezette geïnstalleerde bestand.

Windows Computer Use kon McAfee niet bereiken: `sky.list_apps()` faalt met `Computer Use native pipe is unavailable ... os error 2`, ook na de voorgeschreven retry en volledige reset/herinitialisatie. Er is daardoor geen herstelknop bediend en geen uitzondering toegevoegd. Dit is een technische bedieningsblokkade, geen bewijs dat herstel is uitgevoerd. Een handmatige, bestandsspecifieke herstel/toestaan-stap in McAfee is nog nodig; daarna TakkieAI herstarten en de helper/sneltoets opnieuw controleren. Geen brede uitsluiting van een project- of installatiemap maken.
