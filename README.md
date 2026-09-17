# Sligro-voorraad · Pannenkoekhut

Read-only dashboard voor de Sligro-bestelautomatisering van Pannenkoekhut: voorraad,
koppeltabel, bestellingen/leveringen, verkooptrends en een inkoopadvies-rekenmodule.
Geen login, geen schrijfacties — zie `PROMPT.md` voor de volledige opdracht.

## Stack

- **Astro 7** (static output) + **React-eilanden** (`client:load`) voor de interactieve
  delen: zoeken/filteren (Voorraad, Koppeltabel) en de inkoopadvies-rekenmodule. De
  Verkooptrends-tabel heeft geen interactie nodig en is daarom een gewone `.astro`-component
  zonder client-side JS.
- **Tailwind CSS v4** (`@tailwindcss/vite`), tokens 1-op-1 overgenomen uit
  `design_handoff/materiaalonderhoud-globals.css` → `src/styles/globals.css`. Het custom
  `desktop:`-breakpoint (900px) volgt uit `@theme inline { --breakpoint-desktop: 900px }` in
  dat bestand.
- **`@astrojs/cloudflare`-adapter**, `output: "static"` — geen server-state nodig. Sessies
  (Cloudflare KV) en de Cloudflare Images-binding zijn expliciet uitgeschakeld in
  `astro.config.mjs` (`session: false`, `imageService: "passthrough"`): dit project heeft
  geen sessies, D1 of KV nodig.
- **lucide-react**, stroke-width 2, `currentColor`. Voor niet-interactieve navigatie
  (zijnav/tabbalk) worden de iconen zonder `client:*`-directive gerenderd → puur statische
  SVG, geen extra JS.
- **Vitest** voor de rekenregels in `src/lib/inkoopadvies.ts` (zie `test/inkoopadvies.test.ts`),
  inclusief een cross-check tegen een echte periode/artikel-combinatie uit
  `data/sligro-data.json` (Cola, artikelnummer 192603).
- Geen database, geen ORM, geen auth-bibliotheek, geen Playwright (buiten scope voor dit
  formaat).

## Databron

`data/sligro-data.json` is de brondata (export uit de `sligro-bestelling`-skill), gekopieerd
naar `public/data/sligro-data.json` zodat het als statisch bestand meegebouwd wordt.
`src/lib/data.ts` is de **enige** plek die dit bestand aanraakt — alle pagina's en componenten
krijgen typed data via die module.

### Nieuwe data aanleveren

1. Vraag een nieuwe export op via de `sligro-bestelling`-skill
   (`scripts/export_backoffice_data.py`), exact volgens het schema in `PROMPT.md` §7.
2. Vervang `public/data/sligro-data.json` (en optioneel ook `data/sligro-data.json` als
   archief/bron).
3. `npm run build` — de nieuwe data wordt bij de volgende build ingebouwd.

### Later: live API in plaats van statisch bestand

Zet de env-var `PUBLIC_DATA_URL` op een endpoint dat exact hetzelfde response-schema
teruggeeft. `loadSligroData()` in `src/lib/data.ts` doet dan automatisch een `fetch` naar die
URL in plaats van het statische bestand te importeren — verder is er niets aan de codebase te
wijzigen.

## Rekenregels (Inkoopadvies)

`src/lib/inkoopadvies.ts` implementeert §5.1 uit `PROMPT.md` exact zoals de
`sligro-bestelling`-skill (`scripts/genereer_werkblad.py`) dat doet: gemiddelde verkoop/week →
par-niveau → verpakkingen nodig → vaste voorraad (met `buffer_overrides`) → tekort → te
bestellen. Niet wijzigen zonder dat expliciet te vragen.

## Ontwikkelen

```bash
npm install
npm run dev      # dev-server
npm test         # vitest — rekenregels
npm run build    # astro check + astro build (output naar dist/client)
```

## Iframe-inbedding

Geen `X-Frame-Options` of `Content-Security-Policy: frame-ancestors` gezet (gecontroleerd in
zowel de dev-server als de gebouwde `_headers`). Geraakt getest tot 320px breed, zonder
horizontale scroll op de buitenste pagina — brede tabellen scrollen intern
(`overflow-x-auto`) binnen hun eigen kaart.

## Open punten / bewuste keuzes

- **"Besteld" ontbreekt in het leveringen-schema.** `PROMPT.md` §3 noemt "geadviseerd vs.
  besteld vs. ontvangen" voor de Bestellingen & leveringen-tab, maar het schema in §7 heeft
  alleen `aantal_geadviseerd` en `aantal_ontvangen` per artikelregel. De tab toont daarom alleen
  die twee (in verpakkingen én stuks). Zodra de brondata een `aantal_besteld`-veld krijgt, is
  dat een kleine toevoeging aan `LeveringenTab.tsx`.
- **Dubbele koppeltabel-regels per Sligro-artikelnummer.** Sommige Sligro-artikelen (bv.
  845175, 150819, 153070) hebben twee koppeltabel-regels (twee verschillende
  Lightspeed-producten die naar hetzelfde Sligro-artikel wijzen). Het inkoopadvies rekent — net
  als de Excel-skill — per koppeltabel-regel, dus zo'n artikel kan twee keer in de
  Inkoopadvies-tabel voorkomen met hetzelfde advies. Dit is bewust niet samengevoegd: de
  rekenregels in §5 mogen niet aangepast worden, en dit is exact hoe de skill het ook doet.
- **Referentie in Bestellingen & leveringen** komt 1-op-1 uit `referentie` in de brondata
  (bv. `"Factuur 2605830482416"` of `"BAR / orderId 78766009"`) — geen verdere parsing/opsplitsing.
