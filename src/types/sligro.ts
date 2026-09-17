// Types matching data/sligro-data.json — see PROMPT.md §7 for het canonieke schema.

export type KoppeltabelStatus = "zeker" | "controleer" | "mix" | "nvt";

export interface Mutatie {
  datum: string;
  soort: "telling" | "levering" | "verkoop" | "correctie" | string;
  delta: number;
  bron: string;
}

export interface VoorraadItem {
  artikelnummer: string;
  omschrijving: string;
  aantal_stuks: number;
  laatst_bijgewerkt: string;
  laatste_telling: string;
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
}
