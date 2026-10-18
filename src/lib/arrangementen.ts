import type { Arrangement, Boeking } from "../types/sligro";

export type BoekingStatus = "geweest" | "telt_mee" | "later";

export function bepaalBoekingStatus(
  datum: string,
  vandaag: string,
  wekenVooruit: number,
): BoekingStatus {
  if (datum < vandaag) return "geweest";
  const horizon = new Date(vandaag);
  horizon.setDate(horizon.getDate() + Math.round(wekenVooruit * 7));
  const horizonIso = horizon.toISOString().slice(0, 10);
  return datum <= horizonIso ? "telt_mee" : "later";
}

/** Berekent, per Sligro-artikel, hoeveel stuks een boeking verbruikt: het
 * gekoppelde productsjabloon (per persoon × totaal personen). Geeft lege
 * consumptie als de boeking nog niet aan een sjabloon gekoppeld is. */
export function berekenBoekingConsumptie(
  boeking: Boeking,
  arrangement: Arrangement | undefined,
): Record<string, number> {
  const consumptie: Record<string, number> = {};
  if (!arrangement) return consumptie;
  for (const item of arrangement.items) {
    consumptie[item.sligronummer] = (consumptie[item.sligronummer] ?? 0) + item.per_persoon * boeking.aantal_personen;
  }
  return consumptie;
}

export interface BoekingSamenvatting {
  totaalStuks: number;
  aantalArtikelen: number;
}

export function samenvatBoekingConsumptie(consumptie: Record<string, number>): BoekingSamenvatting {
  const waarden = Object.values(consumptie).filter((v) => v > 0);
  return {
    totaalStuks: waarden.reduce((sum, v) => sum + v, 0),
    aantalArtikelen: waarden.length,
  };
}

/** Som van de consumptie van alle boekingen die binnen de "weken vooruit"-
 * horizon vallen én status "definitief" hebben — gebruikt in het
 * inkoopadvies. "optie"-boekingen zijn nog niet zeker en "voltooid"-
 * boekingen liggen al achter ons, dus die tellen bewust niet mee. Een
 * boeking zonder (of met nog "controleer") sjabloon levert vanzelf 0 op. */
export function berekenBenodigdUitArrangementen(
  boekingen: Boeking[],
  arrangementen: Arrangement[],
  vandaag: string,
  wekenVooruit: number,
): Record<string, number> {
  const totaal: Record<string, number> = {};
  for (const boeking of boekingen) {
    if (boeking.status !== "definitief") continue;
    if (bepaalBoekingStatus(boeking.datum, vandaag, wekenVooruit) !== "telt_mee") continue;
    const arrangement = arrangementen.find((a) => a.id === boeking.arrangement_id && a.status === "zeker");
    const consumptie = berekenBoekingConsumptie(boeking, arrangement);
    for (const [sligronummer, aantal] of Object.entries(consumptie)) {
      totaal[sligronummer] = (totaal[sligronummer] ?? 0) + aantal;
    }
  }
  return totaal;
}
