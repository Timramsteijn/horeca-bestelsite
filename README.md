# Sligro-voorraad & bestel dashboard · Pannenkoekhut

Operationeel dashboard waarmee Pannenkoekhut (horeca-onderdeel van Outdoor Valley) voorraad
bijhoudt, verkopen verwerkt, horeca-arrangementen boekt en Sligro-bestellingen genereert. Dit is
**geen marketingwebsite** — een intern werktool voor het Pannenkoekhut-team. Zie
`PROMPT-bestel-tool.md` voor de volledige opdracht; dit document beschrijft wat er daadwerkelijk
gebouwd is en de keuzes die daarbij gemaakt zijn.

> Dit is de tweede fase van dit project. De eerste fase (zie git-historie, commits vóór de
> architectuurwijziging) was een **read-only** static dashboard zonder schrijfacties. Deze versie
> voegt mutaties, persistentie en een nieuw Arrangementen-onderdeel toe.

## Stack

- **Astro 7** + **React-eilanden** (`client:load`), zelfde fundament als fase 1. Alle zes tabs
  zijn nu React-componenten (ook Verkooptrends, dat voorheen een niet-interactieve
  `.astro`-component was — nu moet het immers live kunnen meebewegen met nieuwe
  Lightspeed-imports).
- **Tailwind CSS v4**, tokens in `src/styles/globals.css` (zie `design_handoff/`), inclusief een
  print-only regel (`.print-area`) voor de bestellijst-afdruk.
- **Zustand** (`src/lib/store.ts`) met de `persist`-middleware (localStorage) en `immer` voor
  ergonomische geneste updates. Eén store bevat de **volledige** dataset (voorraad, koppeltabel,
  leveringen, verkooptrends, arrangementen, boekingen, seizoenen, instellingen) en wordt bij elke
  wijziging naar localStorage geschreven.
- **`@astrojs/cloudflare`-adapter**, `output: "static"`. Sessies/D1/KV blijven uitgeschakeld
  (`session: false` in `astro.config.mjs`) — dit project heeft nog steeds geen *server*-state,
  alleen *client*-state (zie hieronder).
- **lucide-react**, stroke-width 2.
- **`read-excel-file`** voor het clientside inlezen van de RECRAS-boekingenexport (.xlsx), zie
  "RECRAS-import" hieronder. Bewust **niet** het populairdere `xlsx`-pakket (SheetJS): de
  npm-published versie (0.18.5, laatste die SheetJS daar zet) heeft twee onopgeloste
  kwetsbaarheden (prototype pollution, ReDoS — "no fix available" via npm; SheetJS publiceert
  patches alleen nog via hun eigen cdn.sheetjs.com, dat in deze omgeving niet bereikbaar is).
  `read-excel-file` is lichter (alleen lezen, geen schrijf-/opmaakfunctionaliteit) en kende geen
  van die problemen.
- **Vitest**: rekenregels (`src/lib/inkoopadvies.ts`, `src/lib/arrangementen.ts`,
  `src/lib/recras-import.ts`) en CSV/Lightspeed-parsing (`src/lib/csv.ts`, `src/lib/telsheet.ts`,
  `src/lib/lightspeed-import.ts`), 55 tests.

## Architectuur: client-side state, geen server/database

**Belangrijkste keuze, expliciet zo gemaakt (zie opdracht "open punten"):** dit project gebruikt
localStorage als persistentielaag, niet een database. Dat betekent:

- Bij de **eerste** keer openen op een apparaat/browser wordt de meegeleverde
  `public/data/sligro-data.json` ingeladen als startpunt (`useSligroStore.laden()` in
  `src/hooks/useSligroData.ts` + `src/lib/store.ts`).
- Alle mutaties daarna (tellingen bijwerken, Lightspeed-imports, arrangementen/boekingen,
  werkelijke-bestelling-overrides) worden alleen lokaal in die browser opgeslagen.
- **Dit werkt dus niet over meerdere apparaten/gebruikers heen** — een telling die iemand op de
  tablet achter de bar invoert, is niet zichtbaar op een laptop in kantoor. Zodra meerdere
  mensen/apparaten tegelijk moeten kunnen bijwerken, is een echte database (Cloudflare D1 +
  Drizzle, of vergelijkbaar) nodig. Dat is bewust **niet** gebouwd in deze iteratie (de opdracht
  noemt dit zelf als "vraag dit na bij de gebruiker voor livegang").
- Nieuwe data die ík (via git) in `public/data/sligro-data.json` zet (bv. een nieuwe levering of
  verkoopperiode) komt niet automatisch door bij iemand die al lokale wijzigingen heeft — die
  seed wordt maar één keer gebruikt, bij een lege localStorage. Wil je de lokale staat
  terugzetten naar de meegeleverde data: leeg de site-data van deze pagina in de browser
  (devtools → Application → Local Storage, of gewoon de browsergeschiedenis/site-data wissen).
- **Schema-migratie voor bestaande gebruikers**: als het datamodel een nieuw top-level veld
  krijgt (zoals `seizoenen`), vult `laden()` in `src/lib/store.ts` dat alsnog aan met een
  standaardwaarde voor wie al lokale data had van vóór die toevoeging. Zonder dit zou een actie
  die zo'n ontbrekend veld aanspreekt (bv. een seizoen aanmaken) stil vastlopen — zichtbaar
  als "de knop doet niets" — omdat `persist` de oude (onvolledige) staat uit localStorage
  rehydrateert nog vóórdat `laden()` draait.

## De zes onderdelen

| Tab | Inhoud | Schrijfacties |
| --- | --- | --- |
| **Voorraad** | Tabel, zoeken, mutatiehistorie | Per-rij "Bijwerken", bulkmodus "Hele lijst bijwerken", telsheet export/import (CSV) |
| **Koppeltabel** | Lightspeed ↔ Sligro-koppeling, filterpills | Alleen-lezen (zoals fase 1) |
| **Leveringen** | Kaart per bestelling/levering | Alleen-lezen; leveringen komen binnen via de Lightspeed-importknop of worden handmatig toegevoegd aan de brondata |
| **Trends** | Verkoop per periode per artikel (sluit `arrangement_alleen`-artikelen uit) | Alleen-lezen; nieuwe kolom verschijnt automatisch na een Lightspeed-import |
| **Arrangementen** | Boekingen (per RECRAS-boeking gegroepeerd) + productsjablonen | RECRAS-import, handmatige boeking toevoegen, sjablonen CRUD |
| **Inkoopadvies** | Rekenmodule + seizoenkiezer + "werkelijke bestelling"-kolom + bestellijst-modal | Seizoen activeren/deactiveren, werkelijke-bestelling-override, bestellijst genereren (print/CSV) |
| **Beheer → Seizoenen** *(nieuw)* | Per seizoen: naam, doelvoorraad per artikel | Seizoenen aanmaken/hernoemen/verwijderen, activeren, én bewerken — ook als het niet het actieve seizoen is |

Overal zichtbaar: **"Verkopen importeren"**-knop (CSV-upload van een Lightspeed
PRODUCT SUMMARY REPORT) in de header, en een "Data bijgewerkt"-indicator.

## Rekenregels

### Inkoopadvies (`src/lib/inkoopadvies.ts`)

Basisformule ongewijzigd t.o.v. fase 1 (gemiddelde verkoop/week → par-niveau → verpakkingen
nodig → vaste voorraad met buffer-overrides → tekort → te bestellen), met twee aanpassingen:

1. **Itereert nu over `voorraad`-items met `status === "zeker"`**, niet meer over
   koppeltabel-rijen. Elk artikel heeft nu zijn eigen `status`/`verpakkingsgrootte`-velden
   (toegevoegd tijdens de schema-migratie, zie git-historie) — los van de
   Lightspeed-koppelstatus in de koppeltabel. Dit lost ook een gat uit fase 1 op: artikelen
   zonder koppeltabel-rij (bv. losse smaakvarianten van een verzamelartikel) deden toen nooit
   mee in het advies; nu wel, als hun eigen status "zeker" is.
2. **+ "benodigd uit arrangementen"** (`src/lib/arrangementen.ts`): de som van toekomstige
   boekingen (binnen de "weken vooruit"-horizon) wordt bovenop de vaste voorraad opgeteld
   vóórdat het tekort berekend wordt.
3. **Optionele seizoen-override**: omdat de verkoop van sommige producten sterk per seizoen
   verschilt (en het gemiddelde over gekozen periodes dat niet altijd goed vangt), kun je onder
   **Beheer → Seizoenen** een "seizoen" aanmaken — gestart vanuit de automatische berekening,
   maar daarna los daarvan handmatig bij te stellen per artikel, en altijd bewerkbaar, ook als
   het niet het actieve seizoen is. Welk seizoen (of "Automatisch") voor Inkoopadvies geldt,
   activeer je op diezelfde Beheer-pagina of met de snelle kiezer bovenaan de Inkoopadvies-tab
   zelf — die keuze wordt in de store bewaard (`actief_seizoen_id`) en overleeft dus een
   herlaad. Zodra een seizoen actief is, vervangt die handmatige waarde
   `vaste_voorraad_verpakkingen` in de formule (de automatisch berekende waarde blijft als
   referentie zichtbaar via `vaste_voorraad_berekend_verpakkingen`); "benodigd uit
   arrangementen" en de rest van de formule blijven ongewijzigd bovenop komen. Seizoenen worden
   per artikelnummer opgeslagen, dus nieuwe artikelen die na het aanmaken van een seizoen worden
   toegevoegd vallen gewoon terug op de automatische berekening totdat je ze expliciet instelt.

### Arrangementen (`src/lib/arrangementen.ts`)

Eén boeking is gekoppeld aan precies één productsjabloon (`Arrangement`): verbruik =
sjabloon-items × `aantal_personen`. Telt alleen mee in "benodigd uit arrangementen" (en dus in
het inkoopadvies) als (a) de boeking `status === "definitief"` is, (b) de boeking binnen de
"weken vooruit"-horizon valt, én (c) het gekoppelde sjabloon zelf op status "zeker" staat (niet
"controleer" of "nvt" — zie hieronder). Zie `test/arrangementen.test.ts`.

> **Afwijking van een eerdere iteratie**: hiervóór bestond er een aparte "Optie"-entiteit met een
> `vervangt`-mechanisme, bedoeld om bv. 4 halal + 2 glutenvrij + 34 regulier tot 40 personen op te
> laten tellen (subset, niet erbovenop) i.p.v. één vast sjabloon per boeking. Die structuur is
> losgelaten toen we de eerste echte RECRAS-export zagen (zie hieronder): RECRAS zelf levert geen
> hoofd/sub-structuur, alleen een platte lijst losse productregels per boeking. Een dieetvariant
> zou in RECRAS dus als eigen productregel/sjabloon binnenkomen (en dan **optellen**, niet een deel
> vervangen) — dat is nu bewust de aanname, totdat een echt voorbeeld met zo'n geval laat zien dat
> dit niet klopt.

## RECRAS-import (`src/lib/recras-import.ts`, `RecrasImportKnop.tsx`)

Zolang er geen live koppeling met RECRAS is, levert Tim periodiek het rapport "Geboekte
producten" aan als .xlsx-export. Die export bevat per RECRAS-boeking (bv. `29631-1`) meerdere
losse productregels, elk met eigen tijdslot/aantal/status (`definitief`/`optie`/`voltooid`) — geen
hoofd/sub-structuur. De "Boekingen importeren (RECRAS)"-knop op de Arrangementen-tab:

1. Leest het bestand clientside in (`read-excel-file`) en zet de rijen om naar genormaliseerde
   regels (`parseRecrasRijen`) — rijen zonder boekingnummer, productnaam of geldige datum worden
   overgeslagen. Datums worden herkend als `Date`, als tekst (`"2026-10-27 00:00:00"`) of als
   Excel-seriegetal.
2. Matcht elke regel aan een bestaand productsjabloon **op exacte naam** (na trim/lowercase —
   `matchRecrasRegels`). Geen fuzzy matching: RECRAS-productnamen zijn vrije tekst, en een verkeerde
   automatische koppeling is duurder dan een gemiste.
3. Toont een review-stap met de aantallen per status en een lijst ongematchte productnamen, **geturfd**
   (`telPerProductnaam`): hoe vaak en voor hoeveel personen elk product in deze export voorkomt,
   vaakst-voorkomend bovenaan — zo zie je vóór het kiezen al of een product de moeite waard is om
   een sjabloon voor in te richten, i.p.v. daar pas achteraf achter te komen. Per product kies je
   expliciet wat ermee moet gebeuren (standaard: "overslaan", **niets wordt automatisch
   aangemaakt**):
   - **Overslaan** — doe nu niets; de regel komt als "nog niet gekoppeld" in de boekingenlijst te
     staan, met een select om 'm later alsnog te koppelen.
   - **Nieuw sjabloon** — status "controleer", Sligro-verbruik per persoon vul je daarna in op de
     sjabloonkaart.
   - **N.v.t.** — voor RECRAS-"producten" die geen Sligro-verbruik hebben (zaalhuur, een
     reservering, "neem eigen taart mee"): maakt het sjabloon meteen aan met status "nvt", zodat
     een volgende import er niet opnieuw naar vraagt, maar het telt nooit mee.

   Bulk-knoppen ("Alles op …") zetten alle ongematchte producten in één keer op dezelfde keuze.
4. Bij bevestigen vervangt de import **alle eerder via RECRAS geïmporteerde boekingen** (een
   verse, volledige momentopname) — handmatig toegevoegde boekingen (`bron: "handmatig"`) blijven
   staan. Boekingen zonder (of met een nog niet op "zeker" gezet) sjabloon tellen gewoon mee in de
   boekingenlijst, maar met 0 verbruik, totdat je ze koppelt/bevestigt.

Alleen boekingen met status "definitief" tellen mee in het inkoopadvies (zie hierboven);
"optie"/"voltooid" staan wel in de lijst, ter info. Elke productregel toont een select om het
gekoppelde sjabloon te wijzigen — ook nuttig als de automatische naam-match een keer fout zit. De
Productsjablonen-grid heeft filterpills (Alles/Zeker/Controleer/N.v.t.) en toont dezelfde tally
(hoe vaak/voor hoeveel personen geboekt, over alle huidige boekingen heen) per kaart, vaakst
gebruikte sjabloon bovenaan — zodat een lange lijst overzichtelijk blijft en duidelijk is waar het
invullen van Sligro-verbruik het eerst loont.

## CSV-formaten

Zie `src/lib/csv.ts`, `src/lib/telsheet.ts`, `src/lib/sligro-bestelling.ts`,
`src/lib/lightspeed-import.ts`.

- **Telsheet** (export/import, zelfde formaat): `sligro_artikelnummer;artikel;huidige_voorraad;getelde_voorraad`.
- **Sligro-bestelling** (alleen export, vanuit de bestellijst-modal): `artikelnummer;omschrijving;aantal_verpakkingen;aantal_stuks`.
  **Dit kolomformaat is een aanname** — nog te bevestigen tegen het echte Sligro-importformaat
  voor livegang.
- **Lightspeed-verkoopimport**: leest het "PRODUCT SUMMARY REPORT"-CSV rechtstreeks (geen
  tussenstap via de `sligro-bestelling`-skill nodig). Kop-detectie op regex, matching eerst op
  PID, dan exacte productnaam, dan eerste-twee-woorden. **"Mix"-artikelen (verzamelknoppen zoals
  "Twist and drink") worden niet automatisch verdeeld** — daar is in de nieuwe opdracht geen
  rekenregel voor gegeven (in tegenstelling tot de oudere `sligro-bestelling`-skill, die wél een
  verdeelregel had). Zulke regels komen apart terug in de importmelding, niet in de voorraadmutatie.

## Ontwikkelen

```bash
npm install
npm run dev      # dev-server
npm test         # vitest — rekenregels + CSV-parsing
npm run build    # astro check + astro build (output naar dist/client)
```

## Open punten (expliciet genoemd in de opdracht, nog te bevestigen voor livegang)

1. **Echte database voor multi-device.** Zie "Architectuur" hierboven — localStorage is een
   bewuste, tijdelijke keuze.
2. **Sligro CSV-importformaat.** Kolomnamen/volgorde in `buildSligroBestellingCsv` zijn een
   aanname.
3. **Authenticatie/toegang.** Geen login gebouwd — nog te bepalen of dit tool achter een login
   moet.
4. **Mix-artikel-verdeling bij Lightspeed-import.** Zie hierboven; de oudere skill had hiervoor
   wel een regel (proportioneel per periode), deze nieuwe implementatie bewust niet (geen
   rekenregel gespecificeerd in de bestel-tool-opdracht).
5. **"Besteld" ontbreekt nog in het leveringen-schema** (alleen geadviseerd/ontvangen) — erfenis
   uit fase 1, zie `LeveringenTab.tsx`.
6. **Dubbele koppeltabel-regels per Sligro-artikelnummer** (bv. 845175, 150819, 153070) — zie
   git-historie fase 1; nog steeds niet samengevoegd, bewust, net als de onderliggende skill.
7. **RECRAS-koppeling is nog een handmatige .xlsx-import**, geen live API — zie "RECRAS-import"
   hierboven. Wordt vervangen zodra er een echte koppeling met RECRAS komt.
8. **Dieetvarianten/vervangende producten bij een boeking** worden nu als losse, optellende
   productregel aangenomen (zie de afwijking hierboven) — nog te bevestigen aan een echt
   RECRAS-voorbeeld met zo'n geval.

## Iframe-inbedding

Geen `X-Frame-Options`/`Content-Security-Policy: frame-ancestors`. Responsief tot 320px, inclusief
de 6-item mobiele tabbalk (labels truncaten met ellipsis waar nodig).
