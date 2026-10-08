# Opdracht: bouw het Sligro-voorraad & bestel dashboard voor Pannenkoekhut (Outdoor Valley)

Je bouwt een interne webapp waarmee Pannenkoekhut (horeca-onderdeel van Outdoor Valley) voorraad bijhoudt, verkopen verwerkt, horeca-arrangementen boekt en Sligro-bestellingen genereert. Dit is GEEN marketingwebsite — het is een operationeel dashboard voor intern gebruik door het Pannenkoekhut-team.

## Stack

Kies een gangbare moderne stack (React/Next.js aanbevolen vanwege de component-/state-zware UI) tenzij er al een codebase is — gebruik dan die patronen. Voeg persistente opslag toe (database of op zijn minst localStorage) zodat wijzigingen de reload overleven — dit ontbrak in het prototype en is een harde eis voor productie.

## Visuele stijl — Outdoor Valley design system

- Donker anker `#15212B` (navy) voor sidebar/header/donkere kaarten, crème grond `#F4F2EC`, zand `#E7E4DB` als tweede vlak.
- Eén accent: `#1f5fd0` (blauw) voor primaire acties/links — dit is een afwijking van het standaard Outdoor Valley-oranje, gekozen omdat dit een operationeel tool is, niet marketing. Gebruik dit blauw consistent voor primaire knoppen, actieve staten en links.
- Typografie: Carter One voor koppen (nooit boven ~26px hier, dit is geen marketingpagina met grote hero-koppen), Figtree voor alle leestekst/interface (gewichten 400–800). Cijfers die ertoe doen (voorraadaantallen, bestelhoeveelheden) in Figtree 800 of Carter One, groter en zwaarder dan omringende tekst.
- Vorm: 8–10px radius op kaarten/inputs, pill (999px) op alle knoppen/badges/filters. Randen 1px `#d8d5cc`, lichte schaduw op kaarten (`0 3px 10px rgba(21,33,43,.06)`).
- Statuskleuren (badges): groen `#edf3e0`/`#46601a` (zeker/verwerkt/in orde), oranje-rood `#ffe7df`/`#a03c14` (controleer/tekort/open), blauw `#e4ecf9`/`#17469b` (mix/info/telt mee), grijs `#dfddd4`/`#535c61` (n.v.t./neutraal/later).
- Interactie: 160ms transitions, geen scale-animaties, pill-knoppen worden bij hover één tint donkerder.
- Taal: alles in het Nederlands, matter-of-fact, geen marketingtaal.

## Navigatie & layout

Vaste linker sidebar (desktop, ≥900px breed) met logo + 6 secties; op mobiel (<900px) wordt dit een sticky bottom-nav met 6 iconen + labels, en verschuift de sidebar weg. Gebruik een CSS-only breakpoint (media queries), geen JS-breedtemeting, zodat de layout meteen goed rendert zonder flits.

Secties (in volgorde): **Voorraad, Koppeltabel, Bestellingen (leveringen), Trends, Arrangementen, Inkoopadvies**.

Bovenaan elke pagina: paginatitel, "Data bijgewerkt: [datum, tijd]"-indicator, en een "Verkopen importeren"-knop (CSV-upload) die altijd zichtbaar is, ongeacht welke sectie actief is.

## Datamodel

```
Artikel {
  naam: string                // volledige Sligro-omschrijving incl. verpakkingsgrootte
  sligroNummer: string
  vastVoorraad: number        // aantal vaste verpakkingen die altijd op voorraad moeten zijn (par-basis)
  huidigeVoorraad: number     // actuele voorraad in stuks
  verpakkingsgrootte: number  // stuks per Sligro-verpakking
  laatstBijgewerkt: date
  laatsteTelling: date
  status: "zeker" | "controleer"  // "zeker" = komt in inkoopadvies, "controleer" = koppeling nog niet bevestigd
  arrangementAlleen: boolean  // true = alleen besteld via arrangementen, niet los verkocht (bv. BBQ-vlees)
  verkoopPerPeriode: number[] // verkochte stuks per historische periode (voor trends/advies)
}

Mutatie (historie per artikel) {
  type: "TELLING" | "VERKOOP" | "LEVERING" | "CORRECTIE"
  datum: date
  delta: number (+ of -)
  bron: string  // vrije tekst, bv. "fysieke telling 13-09-2026 (CSV Tim)"
}

KoppelRegel (Lightspeed → Sligro) {
  lightspeedArtikel: string
  sligroNummer: string | null
  omschrijving: string | null
  verpakkingsgrootte: string | null
  status: "zeker" | "controleer" | "mix" | "nvt"
  // "mix" = verzamelartikel dat naar meerdere Sligro-artikelen verdeeld wordt (bv. "Frisdrank klein")
  // "nvt" = geen inkoopartikel (bv. statiegeld, fooi)
  notitie: string
}

Arrangement (sjabloon, bv. BBQ, Lunch) {
  id, naam
  items: [{ sligroNummer, perPersoon: number (stuks per persoon, mag decimaal zijn) }]
}

Optie (sjabloon, bv. Halal, Glutenvrij) {
  id, naam
  items: [{ sligroNummer, perPersoon: number, vervangt: sligroNummer | null }]
  // vervangt = optie-item vervangt een standaarditem uit het arrangement i.p.v. erbij te komen
}

Boeking (geboekt arrangement) {
  id, arrangementId, datum, aantalPersonen
  opties: { [optieId]: aantalPersonen }  // subset van aantalPersonen, NIET erbovenop
}

Levering {
  referentie: string  // factuurnummer of order-ID
  besteldDatum, geleverdDatum (optioneel)
  status: "Verwerkt" | "Open"
  regels: [{ naam, sligroNummer, geadviseerd: "verp/stuks", ontvangen: "verp/stuks" }]
}
```

## Scherm 1 — Voorraad

- Zoekbalk (filtert op artikelnaam of Sligro-nummer).
- Tabel: Artikel | Sligro-nr. | Voorraad | Bijgewerkt | Telling | actie-knop. Op smallere breedtes verdwijnen "Bijgewerkt"/"Telling"-kolommen.
- Elke rij is uitklapbaar (klik op de rij): toont mutatiehistorie (telling/verkoop/levering/correctie) met datum, gekleurde badge per type, +/- delta (groen voor plus, rood voor min) en bronvermelding.
- Per-rij bijwerken: knop "Bijwerken" opent een inline invoerveld voor een nieuwe telling (stuks); opslaan voegt een TELLING-mutatie toe en past de voorraad aan.
- Bulkmodus ("Hele lijst bijwerken"): elke rij krijgt een invoerveld; lege velden blijven ongewijzigd; "Telling opslaan" verwerkt alle ingevulde regels in één keer, elk met dezelfde datum/bron ("lijsttelling [datum]").
- **Telsheet-export**: downloadt een CSV met kolommen `sligro_artikelnummer;artikel;huidige_voorraad;getelde_voorraad` (laatste kolom leeg, voor handmatig invullen offline/op papier).
- **Telsheet-import**: CSV upload met dezelfde kolommen (kop-detectie op "artikelnummer"/"sligro" en "geteld"/"telling"/"nieuw"; puntkomma of komma als scheidingsteken); matcht op Sligro-nummer en verwerkt elke regel als een telling. Toon een statusmelding met aantal verwerkte/overgeslagen regels.

## Scherm 2 — Koppeltabel

Koppelt Lightspeed-kassa-artikelnamen aan Sligro-artikelnummers, zodat verkopen automatisch kunnen worden afgeboekt.

- Filterpillen: Alle / Controleer / Mix / Zeker / N.v.t. — gesorteerd met "controleer" bovenaan (meest urgent).
- Tabel: Lightspeed-artikel | Sligro-nr. | Omschrijving | Per verp. | Status (badge) | Notitie.
- De notitie legt per regel uit waarom iets "controleer" of "mix" is (bv. twee mogelijke varianten gevonden, verzamelartikel dat verdeeld wordt).

## Scherm 3 — Bestellingen & leveringen

- Eén kaart per levering/order, gesorteerd meest recent eerst.
- Kaartkop: referentie (factuur- of orderID), besteld/geleverd-datum, statusbadge (Verwerkt/Open).
- Subtabel per kaart: Artikel | Geadviseerd (verp/stuks) | Ontvangen (verp/stuks) — laat verschillen tussen advies en ontvangst zien.

## Scherm 4 — Trends

- Brede tabel: Artikel | Sligro-nr. | kolom per historische periode (verkochte stuks). Alleen artikelen die los verkocht worden (niet `arrangementAlleen`).
- Na een Lightspeed-import verschijnt er een extra kolom rechts met het label van de geïmporteerde periode.
- Tabel scrollt horizontaal bij veel periodes; kolombreedte schaalt met het aantal periodes.

## Scherm 5 — Arrangementen

Twee sub-onderdelen op één pagina:

**A. Geboekte arrangementen** (bovenaan, in een kaart)
- Formulier om een boeking toe te voegen: dropdown arrangement, datumveld, personenveld, en per gedefinieerde optie een apart "waarvan [optie]"-veld. "Toevoegen"-knop alleen actief als arrangement+datum+personen>0 ingevuld zijn.
- Lijst van bestaande boekingen, gesorteerd op datum. Elke boekingsrij is **volledig bewerkbaar**:
  - Datum: date-picker, direct wijzigbaar.
  - Totaal personen: ◂/▸ steppers (min. 1).
  - Per optie (Halal, Glutenvrij, ...): eigen ◂/▸ steppers, geclamped tussen 0 en het totale personenaantal. **Belangrijk:** optie-aantallen zijn een subset van het totaal, niet erbovenop — toon dit expliciet, bv. een apart "waarvan"-blok met "en X regulier" erbij zodat 4 halal + 2 glutenvrij + 34 regulier zichtbaar optelt tot 40, niet tot 46.
  - Verwijderknop per boeking.
  - Statusbadge: "Geweest" (datum in verleden), "Telt mee in advies" (binnen het ingestelde aantal weken vooruit, zie Inkoopadvies), "Later" (daarna) — met bijpassende kleur.
  - Samenvattingstekst: totaal aantal stuks en aantal betrokken artikelen voor deze boeking.

**B. Standaard arrangementen** (kaartgrid)
- Eén donkere kaart per arrangement (BBQ, Lunch, ...): naam, "Per persoon"-label, verwijderknop.
- Per product in de kaart: naam + Sligro-nr., invoerveld voor aantal per persoon (decimalen toegestaan, bv. 1.5), verwijderknop.
- Onderaan de kaart: dropdown om een nieuw product toe te voegen uit alle artikelen.
- Losse kaart "Nieuw arrangement": naam invoeren + aanmaken.

**C. Extra opties** (kaartgrid, zelfde patroon als arrangementen maar lichte kaartkop i.p.v. donker)
- Per product: naam + Sligro-nr., een dropdown "Vervangt niets (extra)" of "Vervangt: [product]" (optie-item kan een standaardproduct vervangen i.p.v. toevoegen), aantal per persoon, verwijderknop.
- Losse kaart "Nieuwe optie": naam + aanmaken.

Wijzigingen aan arrangementen/opties gelden direct voor alle bestaande boekingen (de berekening leest live uit de sjablonen).

## Scherm 6 — Inkoopadvies

- Instellingenkaart: periodepillen (meerdere selecteerbaar, toggle) om te bepalen welke historische periodes meetellen voor het gemiddelde, "Weken vooruit"-veld, "Buffer %"-veld.
- Berekening per artikel (alleen status "zeker"):
  1. Gemiddelde verkoop/week = gemiddelde over geselecteerde periodes (periode-totaal / weken in periode).
  2. Par-niveau = gemiddelde/week × weken vooruit × (1 + buffer%).
  3. Benodigd uit arrangementen = som van boekingen die binnen de "weken vooruit"-horizon vallen (niet in het verleden), per artikel, incl. optie-vervangingen/toevoegingen.
  4. Streefvoorraad = (vaste voorraad in verpakkingen × verpakkingsgrootte) + benodigd uit arrangementen.
  5. Tekort = max(0, streefvoorraad − huidige voorraad).
  6. Geadviseerd aantal verpakkingen = afgerond naar boven (tekort / verpakkingsgrootte).
- Toon alleen artikelen met een tekort > 0, gesorteerd op grootste tekort eerst.
- Tabelkolommen: Artikel | Sligro-nr. | Gem./week | Par-niveau | Vaste voorraad | Arrangementen (extra stuks nodig) | Huidig | Tekort | Advies | **Werkelijke bestelling**.
- "Werkelijke bestelling" is een losse kolom met ◂/▸ steppers per verpakking, startwaarde = advies, maar door de gebruiker aanpasbaar; dit is de waarde die in de uiteindelijke bestelling/CSV terechtkomt (niet het advies).
- Knop "Bestellijst maken · N verp." (uitgeschakeld als er niets te bestellen is) opent een modal/paneel met:
  - Kop: bestellijst-titel, datum, samenvatting (aantal regels/verpakkingen/stuks/leverancier).
  - Tabel: Artikel | Sligro-nr. | Verp. | Stuks (op basis van werkelijke bestelling, alleen regels met aantal > 0).
  - Totaalregel.
  - Acties: "Afdrukken" (print-specifieke CSS die alleen de bestellijst toont) en "**CSV voor Sligro downloaden**".

## CSV-formaten (bevestig bij de gebruiker voor livegang)

- **Telsheet** (export/import, zelfde formaat): `sligro_artikelnummer;artikel;huidige_voorraad;getelde_voorraad`, puntkomma-gescheiden, UTF-8 met BOM.
- **Sligro-bestelling** (export): `artikelnummer;omschrijving;aantal_verpakkingen;aantal_stuks`, puntkomma-gescheiden, UTF-8 met BOM. **Dit is een aanname — het daadwerkelijke Sligro-importformaat (kolomvolgorde/namen) moet bevestigd worden voordat dit productie-klaar is.**
- **Lightspeed-verkoopimport**: vrij CSV/XLSX-formaat ("PRODUCT SUMMARY REPORT"), kop-detectie op regex voor "product/artikel/item" (naamkolom) en "aantal/qty/quantity/verkocht/sold/count" (aantalkolom); scheidingsteken auto-detect (; vs ,); getallen met komma als decimaalteken worden geparsed. Matching verloopt eerst via de Koppeltabel (exacte naam-match), dan via exacte artikelnaam-match, dan via gedeeltelijke match op de eerste twee woorden. Niet-matchende regels tellen mee als "niet gekoppeld" en moeten in de Koppeltabel verschijnen met status "controleer".

## Belangrijke gedragsregels

- Een Lightspeed-import boekt voorraad automatisch af (nieuwe TELLING/VERKOOP-mutatie per geraakt artikel) én voegt de geïmporteerde periode toe als extra kolom in Trends.
- Boekingen met een datum in het verleden tellen niet mee in het inkoopadvies; alleen boekingen binnen "weken vooruit" vanaf vandaag doen dat.
- Alles in het Nederlands; datums in `DD-MM-JJJJ`-notatie.
- Dit is een intern operationeel tool — geen publieke/marketing-stijlregels van het Outdoor Valley design system van toepassing (geen schuine banen, geen Permanent Marker, etc.), wel de kleur/type/vorm-basis hierboven.

## Nog open (vraag dit na bij de gebruiker voor livegang)

1. Echte Sligro-artikelnummers en arrangement-samenstellingen (huidige data in het prototype is verzonnen).
2. Het exacte Sligro CSV-importformaat (kolomnamen/volgorde).
3. Persistentielaag: lokale opslag volstaat voor een prototype, maar voor meerdere gebruikers/apparaten is een echte database nodig.
4. Authenticatie/toegang — is dit tool achter een login nodig?

## Referentiebestand

Het werkende prototype staat in dit project als `Sligro-voorraad dashboard.dc.html` — gebruik dit als functionele/visuele referentie (het is in een proprietary preview-formaat gebouwd, dus kopieer niet de code letterlijk, maar herbouw het gedrag en de styling zoals hierboven beschreven in de gekozen stack).
