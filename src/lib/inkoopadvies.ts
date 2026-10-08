import type { VerkoopPerArtikel, VerkoopPeriode, VoorraadItem } from "../types/sligro";

// Rekenregels 1-op-1 overgenomen uit de sligro-bestelling-skill
// (scripts/genereer_werkblad.py) — zie PROMPT.md §5.1. Niet wijzigen zonder
// dat expliciet te vragen: dit is geen nieuw ontwerp. De "benodigd uit
// arrangementen"-term (stap 4b) is de enige toevoeging, zoals gevraagd in de
// bestel-tool-opdracht (Scherm 6).

export const DEFAULT_WEKEN_VOORUIT = 2;
export const DEFAULT_BUFFER_PCT = 0.15;
export const DEFAULT_BUFFER_VERPAKKINGEN = 1;

export interface InkoopadviesRegel {
  artikelnummer: string;
  omschrijving: string;
  verpakkingsgrootte: number;
  gem_verkoop_per_week: number;
  par_niveau: number;
  verpakkingen_nodig: number;
  buffer_verpakkingen: number;
  vaste_voorraad_verpakkingen: number;
  vaste_voorraad_stuks: number;
  benodigd_uit_arrangementen: number;
  streefvoorraad_stuks: number;
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
  voorraadItems: VoorraadItem[],
  verkoopPerArtikel: Record<string, VerkoopPerArtikel>,
  periodes: VerkoopPeriode[],
  bufferOverrides: Record<string, number>,
  benodigdUitArrangementen: Record<string, number>,
  options: InkoopadviesOptions,
): InkoopadviesRegel[] {
  const wekenVooruit = options.wekenVooruit ?? DEFAULT_WEKEN_VOORUIT;
  const bufferPct = options.bufferPct ?? DEFAULT_BUFFER_PCT;

  const periodeWekenMap = new Map(periodes.map((p) => [p.label, p.weken]));
  const totaalWeken = options.periodeLabels.reduce(
    (sum, label) => sum + (periodeWekenMap.get(label) ?? 0),
    0,
  );

  return voorraadItems
    .filter((item) => item.status === "zeker")
    .map((item): InkoopadviesRegel => {
      const verkoopData = verkoopPerArtikel[item.artikelnummer];
      const totaalVerkocht = options.periodeLabels.reduce((sum, label) => {
        return sum + (verkoopData?.verkoop_per_periode[label] ?? 0);
      }, 0);

      // 1. Gemiddelde verkoop/week
      const gemVerkoopPerWeek = totaalWeken > 0 ? totaalVerkocht / totaalWeken : 0;

      // 2. Par-niveau
      const parNiveau = roundUp(gemVerkoopPerWeek * wekenVooruit * (1 + bufferPct));

      // 3. Verpakkingen nodig
      const verpakkingenNodig =
        item.verpakkingsgrootte > 0 ? roundUp(parNiveau / item.verpakkingsgrootte) : 0;

      // 4. Vaste voorraad (verpakkingen + stuks)
      const bufferVerpakkingen = bufferOverrides[item.artikelnummer] ?? DEFAULT_BUFFER_VERPAKKINGEN;
      const vasteVoorraadVerpakkingen = verpakkingenNodig + bufferVerpakkingen;
      const vasteVoorraadStuks = vasteVoorraadVerpakkingen * item.verpakkingsgrootte;

      // 4b. + benodigd uit arrangementen (toekomstige boekingen binnen de
      // "weken vooruit"-horizon, zie src/lib/arrangementen.ts)
      const benodigdArrangementen = Math.round((benodigdUitArrangementen[item.artikelnummer] ?? 0) * 100) / 100;
      const streefvoorraadStuks = vasteVoorraadStuks + benodigdArrangementen;

      // Huidige voorraad: altijd hele stuks (§5.3 — brondata kan decimalen
      // bevatten door verdeling over varianten, dat rond je bij weergave/gebruik af).
      const huidigeVoorraad = Math.round(item.aantal_stuks);

      // 5. Tekort
      const tekort = Math.max(streefvoorraadStuks - huidigeVoorraad, 0);

      // 6. Te bestellen (verpakkingen)
      const teBestellenVerpakkingen =
        tekort > 0 && item.verpakkingsgrootte > 0 ? roundUp(tekort / item.verpakkingsgrootte) : 0;

      return {
        artikelnummer: item.artikelnummer,
        omschrijving: item.omschrijving,
        verpakkingsgrootte: item.verpakkingsgrootte,
        gem_verkoop_per_week: gemVerkoopPerWeek,
        par_niveau: parNiveau,
        verpakkingen_nodig: verpakkingenNodig,
        buffer_verpakkingen: bufferVerpakkingen,
        vaste_voorraad_verpakkingen: vasteVoorraadVerpakkingen,
        vaste_voorraad_stuks: vasteVoorraadStuks,
        benodigd_uit_arrangementen: benodigdArrangementen,
        streefvoorraad_stuks: streefvoorraadStuks,
        huidige_voorraad: huidigeVoorraad,
        tekort,
        te_bestellen_verpakkingen: teBestellenVerpakkingen,
      };
    })
    .sort((a, b) => b.tekort - a.tekort);
}
