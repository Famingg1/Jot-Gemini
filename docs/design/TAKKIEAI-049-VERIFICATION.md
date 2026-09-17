# TakkieAI 0.4.9 — automatische meetingtitels

Het titelveld is verwijderd uit Nieuwe opname. De bronkeuze blijft beschikbaar. Een losse opname begint als Nieuwe meeting; een opname gestart vanuit een gekoppelde agenda-afspraak gebruikt de naam van die afspraak.

Na transcriptie gebruikt de app de titel uit de bestaande Gemini-samenvatting. Er is geen extra modelaanroep nodig. Bij een agenda-afspraak wordt de naam deterministisch samengesteld als `Fahim x Senna: Planning volgende sprint`. Dit geldt voor afspraken die vanuit de agenda worden gestart; F9 identificeert geen actieve browsermeeting.

Een handmatig aangepaste titel zet automatische naamgeving uit. Dat geldt ook voor wijzigingen tijdens een lopende AI-aanvraag. Opnieuw verwerken stapelt geen voorvoegsels. Zonder bruikbare transcriptinhoud blijft de oorspronkelijke naam staan. Zonder automatische verwerking verschijnt de titel na handmatig transcriberen.

Verificatie: build/lint/native compilatie; regressietest door de volledige transcriber met gesimuleerde Gemini-antwoorden voor losse/agenda/lege/handmatig aangepaste opnames en opnieuw verwerken. Electron-paneltest controleert dat het titelveld ontbreekt en het formulier zonder titel een opname start. Screenshots staan in windows/screenshots/desktop-filter-packaged. Deze wijziging vereist geen nieuwe API of credentials. De promptwijziging is niet opnieuw met een echte Gemini-aanvraag getest.

Desktop-app: geen webserver of mobiele deployment. Compact panel op 375px wordt door dezelfde paneltest gecontroleerd. Bestaande key en opnames blijven behouden tijdens installatie.
