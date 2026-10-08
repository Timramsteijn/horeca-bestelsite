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

// Eén regel in een arrangement- of optiesjabloon: hoeveel stuks van een
// Sligro-artikel er per persoon nodig zijn.
export interface ArrangementItem {
  sligronummer: string;
  per_persoon: number;
}

export interface Arrangement {
  id: string;
  naam: string;
  items: ArrangementItem[];
}

// Optie-item kan een standaarditem van het arrangement vervangen (vervangt
// gezet) of erbij komen (vervangt: null).
export interface OptieItem {
  sligronummer: string;
  per_persoon: number;
  vervangt: string | null;
}

export interface Optie {
  id: string;
  naam: string;
  items: OptieItem[];
}

// aantallen per optie zijn een SUBSET van aantal_personen, niet erbovenop.
export interface Boeking {
  id: string;
  arrangement_id: string;
  datum: string;
  aantal_personen: number;
  opties: Record<string, number>;
}

export interface Instellingen {
  weken_vooruit: number;
  buffer_pct: number;
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
  opties: Optie[];
  boekingen: Boeking[];
  instellingen: Instellingen;
}
