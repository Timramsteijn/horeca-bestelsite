import type { Arrangement } from "../types/sligro";

export type RecrasStatus = "definitief" | "optie" | "voltooid";

// Eén genormaliseerde regel uit een RECRAS "Geboekte producten"-export (zie
// Beheer-knop op de Arrangementen-tab). Eén RECRAS-boeking bestaat zelf al
// uit meerdere van dit soort regels (elk een eigen product, aantal en
// tijdslot) — RECRAS levert dus van huis uit een platte lijst, geen
// hoofd/sub-structuur.
export interface RecrasRegel {
  recras_boeking: string;
  product_naam: string;
  aantal: number;
  datum: string;
  boekingsnaam: string;
  status: RecrasStatus;
}

export interface RecrasMatchRegel extends RecrasRegel {
  arrangement_id: string | null;
}

export function normaliseerProductnaam(naam: string): string {
  return naam.trim().toLowerCase();
}

function naarRecrasStatus(waarde: unknown): RecrasStatus {
  const s = String(waarde ?? "").trim().toLowerCase();
  if (s === "definitief" || s === "optie" || s === "voltooid") return s;
  // Onbekende/lege status behandelen we voorzichtigheidshalve als "optie"
  // (telt dus niet automatisch mee in het inkoopadvies).
  return "optie";
}

/** RECRAS-datums komen als Date (read-excel-file detecteert datumcellen),
 * als tekst ("2026-10-27 00:00:00") of — bij een cel zonder datumopmaak —
 * als Excel-seriegetal (dagen sinds 1899-12-30). */
function naarIsoDatum(waarde: unknown): string {
  if (waarde instanceof Date && !Number.isNaN(waarde.getTime())) {
    return waarde.toISOString().slice(0, 10);
  }
  if (typeof waarde === "string") {
    const match = waarde.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  if (typeof waarde === "number" && Number.isFinite(waarde)) {
    const ms = Math.round((waarde - 25569) * 86400 * 1000);
    const datum = new Date(ms);
    if (!Number.isNaN(datum.getTime())) return datum.toISOString().slice(0, 10);
  }
  return "";
}

/** Zet de ruwe rijen van een RECRAS-export (kolomnamen als keys, zoals ze na
 * het inlezen van de xlsx eruitzien) om naar genormaliseerde regels. Rijen
 * zonder boekingnummer, productnaam of geldige datum worden overgeslagen. */
export function parseRecrasRijen(rijen: Record<string, unknown>[]): RecrasRegel[] {
  const resultaat: RecrasRegel[] = [];
  for (const rij of rijen) {
    const boeking = String(rij["Boeking"] ?? "").trim();
    const productNaam = String(rij["Product"] ?? "").trim();
    const datum = naarIsoDatum(rij["Begindatum"]);
    if (!boeking || !productNaam || !datum) continue;
    resultaat.push({
      recras_boeking: boeking,
      product_naam: productNaam,
      aantal: Number(rij["Aantal"]) || 0,
      datum,
      boekingsnaam: String(rij["Boekingsnaam"] ?? "").trim(),
      status: naarRecrasStatus(rij["Status"]),
    });
  }
  return resultaat;
}

/** Matcht elke regel aan een bestaand productsjabloon op exacte naam (na
 * trim/lowercase) — RECRAS-productnamen zijn verder vrije tekst, dus meer
 * fuzzy matchen voegt vooral risico op foute koppelingen toe. */
export function matchRecrasRegels(regels: RecrasRegel[], arrangementen: Arrangement[]): RecrasMatchRegel[] {
  const perNaam = new Map(arrangementen.map((a) => [normaliseerProductnaam(a.naam), a.id]));
  return regels.map((regel) => ({
    ...regel,
    arrangement_id: perNaam.get(normaliseerProductnaam(regel.product_naam)) ?? null,
  }));
}

/** Unieke productnamen zonder bestaand sjabloon, in volgorde van eerste
 * voorkomen — kandidaten om als nieuw ("controleer") sjabloon aan te maken
 * bij het importeren. */
export function vindOngematchteProducten(regels: RecrasMatchRegel[]): string[] {
  const gezien = new Set<string>();
  const resultaat: string[] = [];
  for (const r of regels) {
    if (r.arrangement_id !== null) continue;
    const key = normaliseerProductnaam(r.product_naam);
    if (gezien.has(key)) continue;
    gezien.add(key);
    resultaat.push(r.product_naam);
  }
  return resultaat;
}

export interface ProductTally {
  naam: string;
  aantalRegels: number;
  aantalPersonen: number;
}

/** Telt, per unieke productnaam, hoeveel regels en hoeveel personen er in
 * totaal voorkomen in de import — gebruikt om in de review-stap en op de
 * sjabloonkaarten te laten zien hoe vaak een product voorkomt ("geturfd"),
 * zodat je kunt inschatten of het de moeite waard is om er een sjabloon
 * voor in te richten vóórdat je dat werk doet, i.p.v. achteraf te ontdekken
 * dat een product maar één keer voorkwam. */
export function telPerProductnaam(regels: RecrasRegel[]): Map<string, ProductTally> {
  const tally = new Map<string, ProductTally>();
  for (const r of regels) {
    const key = normaliseerProductnaam(r.product_naam);
    const bestaand = tally.get(key);
    if (bestaand) {
      bestaand.aantalRegels += 1;
      bestaand.aantalPersonen += r.aantal;
    } else {
      tally.set(key, { naam: r.product_naam, aantalRegels: 1, aantalPersonen: r.aantal });
    }
  }
  return tally;
}
