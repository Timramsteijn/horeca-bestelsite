import type { Arrangement, Boeking, Optie } from "../types/sligro";

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

/** Berekent, per Sligro-artikel, hoeveel stuks een boeking verbruikt: de
 * standaarditems van het arrangement (per persoon × totaal personen), waarbij
 * optie-items die een standaarditem "vervangen" dat aandeel overnemen i.p.v.
 * erbij komen. */
export function berekenBoekingConsumptie(
  boeking: Boeking,
  arrangement: Arrangement | undefined,
  opties: Optie[],
): Record<string, number> {
  const consumptie: Record<string, number> = {};
  if (!arrangement) return consumptie;

  for (const item of arrangement.items) {
    consumptie[item.sligronummer] = (consumptie[item.sligronummer] ?? 0) + item.per_persoon * boeking.aantal_personen;
  }

  for (const [optieId, aantalPersonen] of Object.entries(boeking.opties)) {
    if (aantalPersonen <= 0) continue;
    const optie = opties.find((o) => o.id === optieId);
    if (!optie) continue;
    for (const item of optie.items) {
      consumptie[item.sligronummer] = (consumptie[item.sligronummer] ?? 0) + item.per_persoon * aantalPersonen;
      if (item.vervangt) {
        const vervangenItem = arrangement.items.find((a) => a.sligronummer === item.vervangt);
        if (vervangenItem) {
          consumptie[item.vervangt] =
            (consumptie[item.vervangt] ?? 0) - vervangenItem.per_persoon * aantalPersonen;
        }
      }
    }
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
 * horizon vallen (status "telt_mee") — gebruikt in het inkoopadvies. */
export function berekenBenodigdUitArrangementen(
  boekingen: Boeking[],
  arrangementen: Arrangement[],
  opties: Optie[],
  vandaag: string,
  wekenVooruit: number,
): Record<string, number> {
  const totaal: Record<string, number> = {};
  for (const boeking of boekingen) {
    if (bepaalBoekingStatus(boeking.datum, vandaag, wekenVooruit) !== "telt_mee") continue;
    const arrangement = arrangementen.find((a) => a.id === boeking.arrangement_id);
    const consumptie = berekenBoekingConsumptie(boeking, arrangement, opties);
    for (const [sligronummer, aantal] of Object.entries(consumptie)) {
      totaal[sligronummer] = (totaal[sligronummer] ?? 0) + aantal;
    }
  }
  return totaal;
}
