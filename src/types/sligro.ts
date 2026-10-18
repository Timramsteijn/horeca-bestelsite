// Types matching data/sligro-data.json — see PROMPT.md §7 for het canonieke schema.

export type KoppeltabelStatus = "zeker" | "controleer" | "mix" | "nvt";

export interface Mutatie {
  datum: string;
  soort: "telling" | "levering" | "verkoop" | "correctie" | string;
  delta: number;
  bron: string;
}

// "zeker" = dit artikel komt mee in het Inkoopadvies; "controleer" = koppeling/
// gegevens nog niet bevestigd. Los van KoppeltabelRow.status (dat gaat over de
// Lightspeed-verkoopkoppeling, niet over het artikel zelf — een artikel kan
// bv. alleen via arrangementen ingekocht worden en nooit los verkocht zijn).
export type ArtikelStatus = "zeker" | "controleer";

export interface VoorraadItem {
  artikelnummer: string;
  omschrijving: string;
  aantal_stuks: number;
  verpakkingsgrootte: number;
  laatst_bijgewerkt: string;
  laatste_telling: string;
  status: ArtikelStatus;
  arrangement_alleen: boolean;
  mutaties: Mutatie[];
}

export interface KoppeltabelRow {
  pid: string;
  productnaam: string;
  artikelnummer: string;
  omschrijving: string;
  aantal_per_verpakking: number;
  status: KoppeltabelStatus;
  notitie: string;
}

export interface VerkoopPeriode {
  label: string;
  weken: number;
}

export interface VerkoopPerArtikel {
  omschrijving: string;
  verkoop_per_periode: Record<string, number>;
}

export interface LeveringArtikel {
  artikelnummer: string;
  omschrijving: string;
  aantal_geadviseerd: number;
  aantal_ontvangen: number;
  aantal_per_verpakking: number;
}

export interface Levering {
  besteld_op: string;
  leverdatum: string | null;
  referentie: string;
  verwerkt: boolean;
  artikelen: LeveringArtikel[];
}

// Eén regel in een productsjabloon: hoeveel stuks van een Sligro-artikel er
// per persoon nodig zijn.
export interface ArrangementItem {
  sligronummer: string;
  per_persoon: number;
}

// "controleer" = net aangemaakt (bv. automatisch bij import) en nog zonder
// of met onvolledig Sligro-verbruik — telt niet mee in het inkoopadvies
// totdat je 'm op "zeker" zet. "nvt" = een RECRAS-product dat geen Sligro-
// verbruik heeft (zaalhuur, een reservering, een regel als "eigen taart
// meenemen") — blijft bestaan zodat een volgende import er niet opnieuw om
// vraagt, maar telt nooit mee.
export type ArrangementStatus = "zeker" | "controleer" | "nvt";

// Eén herbruikbaar, boekbaar product (vóór deze iteratie gesplitst in
// Arrangement + Optie — dat onderscheid is losgelaten omdat RECRAS zelf geen
// hoofd/sub-structuur levert, alleen een platte lijst producten per boeking,
// zie Boeking en src/lib/recras-import.ts). "naam" is ook de matchsleutel bij
// het importeren van een RECRAS-export.
export interface Arrangement {
  id: string;
  naam: string;
  items: ArrangementItem[];
  status: ArrangementStatus;
}

// Eén geboekte productregel. Komt ofwel uit een RECRAS "Geboekte producten"-
// export (bron: "recras", zie Beheer-knop op de Arrangementen-tab) of is
// handmatig ingevoerd. arrangement_id is null zolang product_naam nog niet
// aan een sjabloon gekoppeld is (vergelijkbaar met "controleer" in de
// Koppeltabel) — product_naam blijft dan de enige bron van waarheid voor wat
// er geboekt is. status komt 1-op-1 uit RECRAS ("optie" boekingen zijn nog
// niet zeker en tellen niet mee in het inkoopadvies, zie
// berekenBenodigdUitArrangementen); handmatige boekingen zijn altijd
// "definitief".
export interface Boeking {
  id: string;
  arrangement_id: string | null;
  product_naam: string;
  aantal_personen: number;
  datum: string;
  bron: "recras" | "handmatig";
  recras_boeking: string | null;
  boekingsnaam: string | null;
  status: "definitief" | "optie" | "voltooid";
}

export interface Instellingen {
  weken_vooruit: number;
  buffer_pct: number;
}

// Een seizoen is een handmatig ingestelde "vaste voorraad" (in verpakkingen)
// per artikel, als alternatief voor de automatisch berekende par-niveau —
// voor producten die per seizoen structureel meer/minder verkopen dan het
// gemiddelde van de geselecteerde verkoopperiodes laat zien. Ontbreekt een
// artikel in doelvoorraad (bv. nieuw artikel na het aanmaken van het
// seizoen), dan valt de berekening terug op de automatische waarde.
export interface Seizoen {
  id: string;
  naam: string;
  doelvoorraad: Record<string, number>;
}

export interface SligroData {
  gegenereerd_op: string;
  voorraad: Record<string, Omit<VoorraadItem, "artikelnummer">>;
  koppeltabel: KoppeltabelRow[];
  buffer_overrides: Record<string, number>;
  verkoop_periodes: {
    periodes: VerkoopPeriode[];
    per_artikel: Record<string, VerkoopPerArtikel>;
  };
  leveringen: Levering[];
  arrangementen: Arrangement[];
  boekingen: Boeking[];
  instellingen: Instellingen;
  seizoenen: Seizoen[];
  // null = Inkoopadvies gebruikt de automatische berekening; anders het id
  // van het actieve seizoen (zie Seizoen hierboven). Hoort bij de store, niet
  // bij lokale component-state, zodat de keuze een herlaad overleeft.
  actief_seizoen_id: string | null;
}
