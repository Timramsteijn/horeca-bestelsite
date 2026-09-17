# Prompt voor Claude Code — Sligro voorraad & inkoop dashboard (Pannenkoekhut)

> Kopieer alles onder de streep in Claude Code, in een **nieuwe, lege repository**. Voeg dit
> bestand zelf toe aan de repo (bv. `PROMPT.md`) zodat de context bewaard blijft.

---

## 0. Opdracht in één alinea

Bouw een simpel, publiek toegankelijk **read-only dashboard** dat laat zien hoe de
Sligro-bestelautomatisering van Pannenkoekhut ervoor staat: actuele voorraad per artikel, de
koppeltabel (Lightspeed-artikel → Sligro-artikelnummer, met status), bestel-/leveringshistorie,
verkooptrends per periode, en een **inkoopadvies-rekenmodule** waarin je een periode kiest en
meteen ziet wat er (op basis van gemiddelde verkoop + huidige voorraad) besteld zou moeten worden.
Geen login, geen personeelsbeheer, geen rollen — dit is een lees- en rekentool, geen registratie-app.
De site moet zonder wrijving **in te bouwen zijn als `<iframe>`** op een andere website (dus geen
`X-Frame-Options`/`frame-ancestors`-restrictie) én los te bezoeken zijn.

Dit is een broertje van `materiaalonderhoud` (Outdoor Valley) — zelfde huisstijl, veel kleiner in
scope: geen database, geen accounts, geen schrijfacties. De data komt (voorlopig) uit een los
JSON-bestand; zie §7.

## 1. Bronmateriaal / referenties

Er is geen los ontwerpbestand (mockup) voor dít project — volg in plaats daarvan de **design tokens
van `materiaalonderhoud`** (§4 hieronder, letterlijk overgenomen uit die repo's
`design_handoff_materiaalonderhoud/CLAUDE_CODE_PROMPT.md` §4 en `src/app/globals.css`) zodat beide
sites uit dezelfde Outdoor Valley-familie ogen. Bouw geen onderdeel-specifieke UI na uit die repo
(geen scannen, geen QR, geen logboek, geen afkeuring/goedkeuring) — alleen de **look & feel**
(kleuren, typografie, vorm, spacing, kaarten, tabellen, badges) is het voorbeeld.

De brondata komt uit de Claude-skill `sligro-bestelling` (Pannenkoekhut): een koppeltabel
Lightspeed-artikel → Sligro-artikelnummer, een lopende voorraadadministratie, verkoopgeschiedenis
per periode, en een leveringenlog. Het exacte JSON-formaat staat in §7.

## 2. Stack

Er is nog geen codebase. Tenzij je in de repo iets anders aantreft:

- **Astro** (static output) + **React-eilanden** voor de interactieve delen (filters, sorteren,
  de inkoopadvies-rekenmodule) — precies zoals `onderhoud-astro` in de materiaalonderhoud-repo,
  maar dan **zonder** Cloudflare D1/KV, zonder sessies, zonder Astro Actions voor mutaties: dit
  project heeft geen server-state nodig.
- **Tailwind CSS** met de tokens uit §4 als CSS-variabelen, exact zoals `src/app/globals.css` in
  `materiaalonderhoud` (kopieer dat bestand als vertrekpunt).
- **Geen database, geen ORM, geen auth-bibliotheek.** Data komt uit een JSON-bestand of URL, zie §7.
- **Iconen**: `lucide-react` (of `lucide-astro`), stroke-width 2, 20px in tekst, 24px in knoppen,
  `currentColor` — zelfde als materiaalonderhoud.
- **Hosting: Cloudflare** (Cloudflare Pages/Workers), zelfde `@astrojs/cloudflare`-adapter als
  `onderhoud-astro` in de materiaalonderhoud-repo — maar met `output: "static"` (geen server nodig:
  dit project heeft geen sessies, geen D1/KV, geen Astro Actions). Geen `X-Frame-Options` /
  `Content-Security-Policy: frame-ancestors` zetten, zodat inbedden via `<iframe>` op de Outdoor
  Valley-website werkt.
- **Tests**: Vitest voor de rekenregels in §6 (dit is de kern van de app — dekk die goed), geen
  Playwright verplicht gezien de beperkte scope.

Wijk hiervan af als je een goede reden hebt; leg de keuze dan vast in de repo-README. Vraag niet om
bevestiging voor routinekeuzes — bouw en documenteer.

## 3. Wat er te zien is (schermen)

Eén layout: navy topbalk (logo + titel "Sligro-voorraad · Pannenkoekhut"), daaronder een simpele
tabbalk/zijnav (mobiel boven, desktop links — zelfde breekpunt-logica als materiaalonderhoud,
~900px) met vijf onderdelen. Geen inlogscherm, geen onderdelenkeuze — je landt direct op Voorraad.

| Tab | Inhoud |
| --- | --- |
| **Voorraad** | Tabel: artikel, Sligro-artikelnummer, huidige voorraad (stuks), laatst bijgewerkt, laatste telling. Zoeken op naam/artikelnummer. Klik op een rij toont de mutatiehistorie (telling/levering/verkoop/correctie, datum, delta, bron) in een uitklaprij of paneel. |
| **Koppeltabel** | Tabel: Lightspeed-artikel, productnaam, Sligro-artikelnummer, omschrijving, aantal per verpakking, status-badge (zeker=groen, controleer=amber, mix=blauw-achtig, nvt=neutraal), notitie. Filterpills op status, "controleer" en "mix" staan default bovenaan (zie §6.2 in de skill: dit is precies hoe het Excel-tabblad "Koppeltabel overzicht" al gesorteerd/gekleurd is — zelfde regel hier). |
| **Bestellingen & leveringen** | Per geplaatste bestelling: datum, referentie, verwerkt-status, en de artikelregels (geadviseerd vs. besteld vs. ontvangen, in verpakkingen én omgerekend naar stuks). |
| **Verkooptrends** | Tabel of eenvoudige staafjes: verkoop per periode per Sligro-artikelnummer (de periodes uit de brondata, naast elkaar — geen tijdreeks-datepicker nodig, het zijn een handvol vaste periodes). |
| **Inkoopadvies** | De rekenmodule uit §6.1: kies een periode (of een reeks periodes om het gemiddelde over te berekenen), pas eventueel "weken vooruit" en "buffer %" aan (defaults 2 weken / 15%, zelfde als de Excel-skill), en zie per artikel par-niveau → vaste voorraad → tekort → te bestellen (verpakkingen). Sorteer op grootste tekort eerst. Dit is een **client-side berekening** op de al geladen data, geen aparte call nodig. |

Alle vier databronnen mogen ontbrekende/lege secties tonen zonder te crashen (bv. nog geen
leveringen) — toon dan een neutrale lege-staat, geen foutmelding.

## 4. Design tokens — Outdoor Valley (overgenomen uit `materiaalonderhoud`)

Kopieer deze tokens **letterlijk** — ze staan al zo, kant-en-klaar, in
`design_handoff/materiaalonderhoud-globals.css` (1-op-1 overgenomen uit de materiaalonderhoud-repo).
Neem dat bestand als basis in plaats van over te typen.

### Fonts

```html
<link href="https://fonts.googleapis.com/css2?family=Carter+One&family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- **Carter One** — alle koppen en grote cijfers (bv. "89 stuks", "Te bestellen: 3"). Nooit
  kapitalen, nooit cursief, nooit boven 50px.
- **Figtree** — lopende tekst (400), nadruk (500/600), en alle interface-tekst/labels/badges/
  artikelnummers in 700/800. Labels uppercase met letter-spacing .10–.16em.
- Geen Permanent Marker, geen cursief.

### Kleuren

| Rol | Hex |
| --- | --- |
| Navy — chrome (topbalk, zijnav) | `#15212b` |
| Navy lichter | `#1e2e3a` |
| Rand op donker | `#2c3f4e` |
| Tekst secundair op donker | `#b5b7b6` |
| Crème — kaartvlak | `#f4f2ec` |
| Zand — paginagrond | `#e7e4db` |
| Rand/divider op licht | `#d8d5cc` |
| Neutrale vulling / badge-grond | `#dfddd4` |
| Tekst gedempt op licht | `#535c61` |
| Tekst medium op licht | `#3c4a52` |
| Tekst / inkt | `#15212b` |
| **Accent** (pisteblauw, zelfde als Ski & Snowboard-onderdeel) — basis/hover-pressed/tint | `#1f5fd0` / `#17469b` / `#e4ecf9` |
| Accenttekst op licht | `#17469b` |
| Status groen (zeker/goed) — tekst/cijfer/tint | `#46601a` / `#6b942a` / `#edf3e0` |
| Status amber (controleer/tekort) — tekst/tint | `#a03c14` / `#ffe7df` |
| Status rood (kritiek/negatief) — tekst/tint | `#9e2f23` / `#f7e3df` |
| Status neutraal (mix/nvt) — tekst/tint | `#17469b` / `#dfddd4` |

Eén accentkleur voor de hele app (geen per-onderdeel accenten zoals in materiaalonderhoud — hier is
maar één "onderdeel"). Tekst op een accentvlak is crème `#f4f2ec`. Alle tekst haalt 4.5:1 contrast
(koppen ≥24px mogen 3:1).

### Vorm, schaduw, spacing

- Radii: kaarten/panelen **10px**, inputs **8px**, knoppen/chips/badges **999px** (volledig rond).
- Schaduw alleen op kaarten, recht naar beneden, geen glow: `0 3px 10px rgba(21,33,43,.06)`,
  hover `0 8px 20px rgba(21,33,43,.12)`.
- Randen 1px `#d8d5cc` op licht, 1px `#2c3f4e` op donker.
- Spacing: schermpadding mobiel 18px horizontaal, desktopcontent 22–26px, kaartpadding 13–18px,
  gap tussen kaarten 9–14px.
- Vlakke kleuren. Geen gradients, geen textuur, geen blur, geen glas-effect, geen emoji.
- Beweging: 160ms, één easing, geen bounce, geen entree-animaties. Stil onder
  `prefers-reduced-motion`.
- Focus: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` op alles
  interactief.

### Logo

Gebruik het Outdoor Valley-logo (`design_handoff/logo-ov-mark.svg` / `design_handoff/logo-ov.svg`,
al in deze repo) als masker, zelfde regels als in materiaalonderhoud: nooit vervormen, ondergrens
52px voor het volledige logo / 18px voor het losse merkteken. Verplaats de bestanden naar `public/`
(of waar de gekozen stack statische assets verwacht) als onderdeel van de bouw.

## 5. Rekenregels — hier zit de inhoud van de app, niet in de UI

Deze regels zijn **niet nieuw bedacht**: het zijn exact de regels uit de `sligro-bestelling`-skill
(`scripts/genereer_werkblad.py`), hier hergebruikt zodat het dashboard hetzelfde advies geeft als
het Excel-werkblad dat de skill genereert.

### 5.1 Inkoopadvies (per artikel, voor een gekozen periode-selectie)

1. **Gemiddelde verkoop/week** = som van verkochte stuks in de gekozen periode(s) ÷ som van de
   weken die die periode(s) dekken.
2. **Par-niveau** = `ROUNDUP(gem. verkoop/week × weken_vooruit × (1 + buffer%), 0)` — defaults:
   `weken_vooruit = 2`, `buffer% = 0.15`. Beide instelbaar in de UI, herberekent live.
3. **Verpakkingen nodig** = `ROUNDUP(par-niveau ÷ aantal_per_verpakking, 0)`.
4. **Vaste voorraad (verpakkingen)** = verpakkingen nodig + bufferverpakkingen. Bufferverpakkingen
   is standaard **1**, tenzij het artikel een override heeft (zie `buffer_overrides` in §7 — daar
   staat per artikelnummer een afwijkend aantal, bv. 0 voor de HARIBO-lijn).
5. **Vaste voorraad (stuks)** = vaste voorraad (verpakkingen) × aantal_per_verpakking.
6. **Tekort** = `MAX(vaste voorraad (stuks) − huidige voorraad, 0)`.
7. **Te bestellen (verpakkingen)** = `ROUNDUP(tekort ÷ aantal_per_verpakking, 0)` (0 als tekort 0 is).

Alleen artikelen met status `zeker` in de koppeltabel doen mee in het advies (net als in de skill —
`controleer`/`mix`/`nvt` blijven zichtbaar in de koppeltabel-tab maar leveren geen inkoopadvies op).

### 5.2 Statuskleuren koppeltabel

`zeker` = groen, `controleer` = amber, `mix` = het neutrale "keuring"-blauw, `nvt` = neutrale
vulling. Sorteer default zo dat `controleer` en `mix` bovenaan staan (dat zijn de artikelen die
aandacht nodig hebben) — exact de sortering die het Excel-tabblad "Koppeltabel overzicht" al
gebruikt.

### 5.3 Afronden

Alle voorraadaantallen zijn **hele stuks** — er bestaan geen halve producten. Rond bij het tonen
altijd af op een geheel getal (de brondata kán decimalen bevatten door verdeling over meerdere
smaken/varianten; dat rond je in de weergave af, je verzint geen precisie die er niet is).

## 6. Interactie & gedrag

- Geen inloggen, geen rollen, geen "wijzig deze bestellijst"-acties — dit is puur lezen en
  doorrekenen. Instellingen (weken vooruit, buffer%) mogen wél live aangepast worden binnen de
  Inkoopadvies-tab; dat is client-side state, geen opslag nodig.
- Zoeken op de Voorraad- en Koppeltabel-tab: filtert op naam + artikelnummer, case-insensitive,
  live, en de resultaatregel noemt het aantal ("{n} van {totaal} artikelen").
- Lege/onbekende toestanden zijn benoemd, nooit een stille lege pagina: "Nog geen leveringen
  geregistreerd", "Geen artikelen gevonden voor '{zoekterm}'".
- Reponsief: mobiel (< 900px) navy header + onderaan een simpele tabbalk (5 iconen: `package`
  Voorraad, `link` Koppeltabel, `truck` Leveringen, `trending-up` Trends, `calculator`
  Inkoopadvies); desktop (≥ 900px) een 232px navy zijnav + 66px witte topbalk, content ernaast.

## 7. Databron

**Nu:** een los JSON-bestand, al aanwezig in deze repo op `data/sligro-data.json` (een echte export
van de huidige Pannenkoekhut-voorraad, niet fictieve testdata). Verplaats het naar waar de gekozen
stack statische data verwacht (bv. `public/data/`), of laad het via een env-var `PUBLIC_DATA_URL`.
Bouw de data-laag als **één module** (`src/lib/data.ts` oid.) die dit bestand ophaalt/parseert en de
rest van de app typed objecten teruggeeft — geen component leest ooit rechtstreeks het JSON-bestand.

**Straks (niet nu bouwen, wel op voorbereiden):** dezelfde module wordt de wens een live
API-koppeling — leg de laag zo aan dat "vervang de fetch van het statische bestand door een fetch
naar een endpoint met exact dit response-schema" de enige wijziging is. Geen aannames over
authenticatie voor die toekomstige API; dat is een latere vraag.

### Schema van `sligro-data.json`

```jsonc
{
  "gegenereerd_op": "2026-09-17T10:00:00Z",
  "voorraad": {
    "192603": {
      "omschrijving": "Coca-Cola Cola regular Krat 24 flesjes x 20 cl",
      "aantal_stuks": 89,
      "laatst_bijgewerkt": "2026-09-14",
      "laatste_telling": "2026-09-13",
      "mutaties": [
        { "datum": "2026-09-14", "soort": "verkoop", "delta": -4, "bron": "2026-09-07 - 2026-09-14" },
        { "datum": "2026-09-13", "soort": "telling", "delta": 94, "bron": "fysieke telling" }
      ]
    }
  },
  "koppeltabel": [
    {
      "pid": "b1",
      "productnaam": "Cola",
      "artikelnummer": "192603",
      "omschrijving": "Coca-Cola Cola regular Krat 24 flesjes x 20 cl",
      "aantal_per_verpakking": 24,
      "status": "zeker",
      "notitie": ""
    }
  ],
  "buffer_overrides": { "98705": 0 },
  "verkoop_periodes": {
    "periodes": [{ "label": "2026-09-07 - 2026-09-14", "weken": 1.0 }],
    "per_artikel": {
      "192603": {
        "omschrijving": "Coca-Cola Cola regular Krat 24 flesjes x 20 cl",
        "verkoop_per_periode": { "2026-09-07 - 2026-09-14": 4 }
      }
    }
  },
  "leveringen": [
    {
      "besteld_op": "2026-09-14",
      "leverdatum": "2026-09-16",
      "referentie": "Factuur 2605830482416",
      "verwerkt": true,
      "artikelen": [
        {
          "artikelnummer": "127441",
          "omschrijving": "Fanta Cassis Krat 24 flesjes x 20 cl",
          "aantal_geadviseerd": 1,
          "aantal_ontvangen": 1,
          "aantal_per_verpakking": 24
        }
      ]
    }
  ]
}
```

Dit bestand wordt geëxporteerd door de skill zelf (`scripts/export_backoffice_data.py`, al
toegevoegd aan `sligro-bestelling`) — vraag die uitvoer op in plaats van het schema hierboven
opnieuw te interpreteren; het is bewust exact dit schema.

## 8. Inbedden op een andere website

- Geen `X-Frame-Options`, geen `Content-Security-Policy: frame-ancestors` — moet standaard in een
  `<iframe>` passen.
- Responsief vanaf ~320px breed (een iframe kan smal staan), geen horizontale scroll op de
  buitenste pagina.
- Geen navigatie die uit de iframe probeert te breken (`target="_top"` alleen als dat expliciet
  gewenst is, niet stiekem).
- Werkt ook als losse, volwaardige pagina (los bezocht, niet alleen ge-iframed).

## 9. Bouwvolgorde

1. **Fundament** — Astro-project, Tailwind-theme met tokens uit §4 (kopieer `globals.css` uit
   `materiaalonderhoud`), fonts, logo, layoutshell (navy topbalk/zijnav, tabbalk mobiel).
2. **Data** — `src/lib/data.ts`, het `sligro-data.json`-voorbeeldbestand (vraag dit op via de
   skill, of gebruik voorlopig fictieve testdata met dit schema), typedefinities.
3. **Voorraad-tab** — tabel, zoeken, mutatiehistorie per artikel.
4. **Koppeltabel-tab** — tabel, statusbadges, sortering/filter.
5. **Bestellingen & leveringen-tab.**
6. **Verkooptrends-tab.**
7. **Inkoopadvies-tab** — de rekenmodule uit §5.1, met de instelbare weken/buffer%, Vitest-dekking
   voor alle rekenregels.
8. **Afronden** — lege-staten, contrastcheck, focusringen, iframe-embedding testen, README met
   uitleg hoe je een nieuwe `sligro-data.json` aanlevert.

## 10. Klaar wanneer

- Alle vijf tabs werken op mobiel en desktop, volgen de tokens uit §4.
- Het inkoopadvies in de app geeft **exact** hetzelfde resultaat als het Excel-tabblad "Vaste
  voorraad" van de skill, bij gelijke instellingen (weken vooruit / buffer% / buffer-overrides) —
  reken dit na met een testcase uit `sligro-data.json`.
- De site werkt zonder JavaScript-crash als een sectie leeg is (nog geen leveringen, geen
  verkoopdata voor een periode, etc.).
- De site is te openen in een `<iframe>` zonder blokkade en blijft bruikbaar op 320px breed.
- Geen enkele schrijfactie, login of rol in de hele app.

## 11. Niet doen

- Geen login, geen accounts, geen rollen, geen personeelsbeheer.
- Geen schrijfacties naar Sligro, geen orderplaatsing vanuit deze site — puur advies en overzicht.
- Geen database, geen server-side state, geen sessies.
- Geen aanpassingen aan de rekenregels in §5 zonder dat expliciet te vragen — dit zijn de regels uit
  de skill, niet een nieuw ontwerp.
- Geen features bijbedenken die niet in dit document staan. Kom je iets tegen dat ontbreekt, bouw
  dan het simpelste dat past en zet het als open punt in de repo-README.
