import type { KoppeltabelRow, VerkoopPerArtikel, VerkoopPeriode } from "../types/sligro";

// Rekenregels 1-op-1 overgenomen uit de sligro-bestelling-skill
// (scripts/genereer_werkblad.py) — zie PROMPT.md §5.1. Niet wijzigen zonder
// dat expliciet te vragen: dit is geen nieuw ontwerp.

export const DEFAULT_WEKEN_VOORUIT = 2;
export const DEFAULT_BUFFER_PCT = 0.15;
export const DEFAULT_BUFFER_VERPAKKINGEN = 1;

export interface InkoopadviesRegel {
  pid: string;
  artikelnummer: string;
  productnaam: string;
  omschrijving: string;
  aantal_per_verpakking: number;
  gem_verkoop_per_week: number;
  par_niveau: number;
  verpakkingen_nodig: number;
  buffer_verpakkingen: number;
  vaste_voorraad_verpakkingen: number;
  vaste_voorraad_stuks: number;
  huidige_voorraad: number;
  tekort: number;
  te_bestellen_verpakkingen: number;
}

export interface InkoopadviesOptions {
  periodeLabels: string[];
  wekenVooruit?: number;
  bufferPct?: number;
}

/** Excel-ROUNDUP(getal, 0): naar boven afronden op een geheel getal, met een
 * kleine epsilon-correctie tegen drijvendekomma-afrondfouten (bv. 2.9999999996). */
export function roundUp(value: number, epsilon = 1e-9): number {
  if (value <= 0) return 0;
  return Math.ceil(value - epsilon);
}

export function berekenInkoopadvies(
  koppeltabel: KoppeltabelRow[],
  voorraadStuks: Record<string, number>,
  verkoopPerArtikel: Record<string, VerkoopPerArtikel>,
  periodes: VerkoopPeriode[],
  bufferOverrides: Record<string, number>,
  options: InkoopadviesOptions,
): InkoopadviesRegel[] {
  const wekenVooruit = options.wekenVooruit ?? DEFAULT_WEKEN_VOORUIT;
  const bufferPct = options.bufferPct ?? DEFAULT_BUFFER_PCT;

  const periodeWekenMap = new Map(periodes.map((p) => [p.label, p.weken]));
  const totaalWeken = options.periodeLabels.reduce(
    (sum, label) => sum + (periodeWekenMap.get(label) ?? 0),
    0,
  );

  return koppeltabel
    .filter((row) => row.status === "zeker")
    .map((row): InkoopadviesRegel => {
      const verkoopData = verkoopPerArtikel[row.artikelnummer];
      const totaalVerkocht = options.periodeLabels.reduce((sum, label) => {
        return sum + (verkoopData?.verkoop_per_periode[label] ?? 0);
      }, 0);

      // 1. Gemiddelde verkoop/week
      const gemVerkoopPerWeek = totaalWeken > 0 ? totaalVerkocht / totaalWeken : 0;

      // 2. Par-niveau
      const parNiveau = roundUp(gemVerkoopPerWeek * wekenVooruit * (1 + bufferPct));

      // 3. Verpakkingen nodig
      const verpakkingenNodig =
        row.aantal_per_verpakking > 0 ? roundUp(parNiveau / row.aantal_per_verpakking) : 0;

      // 4-5. Vaste voorraad (verpakkingen + stuks)
      const bufferVerpakkingen = bufferOverrides[row.artikelnummer] ?? DEFAULT_BUFFER_VERPAKKINGEN;
      const vasteVoorraadVerpakkingen = verpakkingenNodig + bufferVerpakkingen;
      const vasteVoorraadStuks = vasteVoorraadVerpakkingen * row.aantal_per_verpakking;

      // Huidige voorraad: altijd hele stuks (§5.3 — brondata kan decimalen
      // bevatten door verdeling over varianten, dat rond je bij weergave/gebruik af).
      const huidigeVoorraad = Math.round(voorraadStuks[row.artikelnummer] ?? 0);

      // 6. Tekort
      const tekort = Math.max(vasteVoorraadStuks - huidigeVoorraad, 0);

      // 7. Te bestellen (verpakkingen)
      const teBestellenVerpakkingen =
        tekort > 0 && row.aantal_per_verpakking > 0 ? roundUp(tekort / row.aantal_per_verpakking) : 0;

      return {
        pid: row.pid,
        artikelnummer: row.artikelnummer,
        productnaam: row.productnaam,
        omschrijving: row.omschrijving,
        aantal_per_verpakking: row.aantal_per_verpakking,
        gem_verkoop_per_week: gemVerkoopPerWeek,
        par_niveau: parNiveau,
        verpakkingen_nodig: verpakkingenNodig,
        buffer_verpakkingen: bufferVerpakkingen,
        vaste_voorraad_verpakkingen: vasteVoorraadVerpakkingen,
        vaste_voorraad_stuks: vasteVoorraadStuks,
        huidige_voorraad: huidigeVoorraad,
        tekort,
        te_bestellen_verpakkingen: teBestellenVerpakkingen,
      };
    })
    .sort((a, b) => b.tekort - a.tekort);
}
