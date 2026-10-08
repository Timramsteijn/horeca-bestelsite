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
  leveringen, verkooptrends, arrangementen, opties, boekingen, instellingen) en wordt bij elke
  wijziging naar localStorage geschreven.
- **`@astrojs/cloudflare`-adapter**, `output: "static"`. Sessies/D1/KV blijven uitgeschakeld
  (`session: false` in `astro.config.mjs`) — dit project heeft nog steeds geen *server*-state,
  alleen *client*-state (zie hieronder).
- **lucide-react**, stroke-width 2.
- **Vitest**: rekenregels (`src/lib/inkoopadvies.ts`, `src/lib/arrangementen.ts`) en CSV/Lightspeed-
  parsing (`src/lib/csv.ts`, `src/lib/telsheet.ts`, `src/lib/lightspeed-import.ts`), 44 tests.

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

## De zes onderdelen

| Tab | Inhoud | Schrijfacties |
| --- | --- | --- |
| **Voorraad** | Tabel, zoeken, mutatiehistorie | Per-rij "Bijwerken", bulkmodus "Hele lijst bijwerken", telsheet export/import (CSV) |
| **Koppeltabel** | Lightspeed ↔ Sligro-koppeling, filterpills | Alleen-lezen (zoals fase 1) |
| **Leveringen** | Kaart per bestelling/levering | Alleen-lezen; leveringen komen binnen via de Lightspeed-importknop of worden handmatig toegevoegd aan de brondata |
| **Trends** | Verkoop per periode per artikel (sluit `arrangement_alleen`-artikelen uit) | Alleen-lezen; nieuwe kolom verschijnt automatisch na een Lightspeed-import |
| **Arrangementen** *(nieuw)* | Boekingen + sjablonen (arrangementen) + extra opties | Volledige CRUD |
| **Inkoopadvies** | Rekenmodule + "werkelijke bestelling"-kolom + bestellijst-modal | Werkelijke-bestelling-override, bestellijst genereren (print/CSV) |

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

### Arrangementen (`src/lib/arrangementen.ts`)

Optie-items met een `vervangt`-veld nemen het aandeel van dat standaarditem over (subset, niet
erbovenop) — bv. 4 halal + 2 glutenvrij + 34 regulier telt op tot 40 personen, niet 46. Zie
`test/arrangementen.test.ts` voor de uitgewerkte rekenvoorbeelden.

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

## Iframe-inbedding

Geen `X-Frame-Options`/`Content-Security-Policy: frame-ancestors`. Responsief tot 320px, inclusief
de 6-item mobiele tabbalk (labels truncaten met ellipsis waar nodig).
