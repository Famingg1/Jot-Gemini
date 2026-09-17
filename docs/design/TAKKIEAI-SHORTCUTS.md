# Zelf opgenomen sneltoetsen — 0.4.4

Instellingen → Algemeen biedt één tot acht combinaties met opnemen, wijzigen en verwijderen. Fysieke linker-/rechtermodificatietoetsen worden apart opgeslagen. De bestaande enkelvoudige instelling wordt als eerste binding gebruikt zolang geen customlijst is opgeslagen.

De opname-interface blokkeert lokale standaardtoetsacties en pauzeert de globale helper. Esc, dialoog sluiten, focus verliezen of timeout herstellen de bestaande configuratie. De main-process IPC is uitsluitend toegankelijk voor de lokale hoofdwindow en staat geen configuratieopname tijdens audio-opname toe. Gewone letters/cijfers vereisen een modifier; overlappende combinaties worden geweigerd.

De C# matcher ondersteunt meerdere bindingen, autorepeat, verschillende loslaatvolgordes en geslikte key-up events. Een niet-gerelateerde instellingenwijziging reset de matcher niet. Globale sneltoetsen gebruiken dezelfde dictatiefunctie als voorheen: vasthouden, loslaten en spatie voor handsfree.

## Verificatie

- JS-validatietest: migratie, serialisatie, onbekende toetsen, prefixoverlap en gereserveerde combinaties.
- De echte C# matcher wordt gecompileerd en getest op combinaties, herhaling, modifier eerst loslaten, tweede binding en pauzeren/herstellen.
- UI-smoke neemt Linker Ctrl + K op naast Rechter Ctrl en controleert opslag, geen audio-opname en annuleren met Esc.
- Screenshots en resultaten: `windows/screenshots/shortcuts044` en `shortcuts-final044`.
- Geen fysieke end-to-end proef met alle toetsenborden of conflictdetectie tegenover alle andere apps. Windows-reserveringen en software van derden kunnen bepaalde combinaties overnemen.
