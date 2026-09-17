import type { KoppeltabelRow, SligroData, VoorraadItem } from "../types/sligro";

// Enige plek die het bronbestand aanraakt. Vandaag: statisch JSON-bestand
// (public/data/sligro-data.json, gebouwd door de sligro-bestelling-skill).
// Straks: zet PUBLIC_DATA_URL en dit wordt zonder verdere wijziging een
// fetch naar een live endpoint met exact dit response-schema (zie PROMPT.md §7).
export async function loadSligroData(): Promise<SligroData> {
  const dataUrl = import.meta.env.PUBLIC_DATA_URL;

  if (dataUrl) {
    const res = await fetch(dataUrl);
    if (!res.ok) {
      throw new Error(`Kon Sligro-data niet laden van ${dataUrl}: HTTP ${res.status}`);
    }
    return (await res.json()) as SligroData;
  }

  // Build-time fallback: statisch JSON-bestand, ingebundeld door Vite (werkt
  // ook binnen de Cloudflare-prerenderer, waar node:fs geen toegang heeft tot
  // de repo op schijf).
  const module = await import("../../public/data/sligro-data.json");
  return module.default as unknown as SligroData;
}

export function getVoorraadItems(data: SligroData): VoorraadItem[] {
  return Object.entries(data.voorraad)
    .map(([artikelnummer, item]) => ({ artikelnummer, ...item }))
    .sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, "nl"));
}

const STATUS_SORT_ORDER: Record<string, number> = {
  controleer: 0,
  mix: 1,
  zeker: 2,
  nvt: 3,
};

// Zelfde sortering als het Excel-tabblad "Koppeltabel overzicht": controleer
// en mix (aandacht nodig) staan bovenaan (PROMPT.md §5.2).
export function getKoppeltabel(data: SligroData): KoppeltabelRow[] {
  return [...data.koppeltabel].sort((a, b) => {
    const orderDiff = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return a.productnaam.localeCompare(b.productnaam, "nl");
  });
}

export function getLeveringen(data: SligroData) {
  return [...data.leveringen].sort((a, b) => (a.besteld_op < b.besteld_op ? 1 : -1));
}

export function getVerkoopPeriodes(data: SligroData) {
  return data.verkoop_periodes.periodes;
}

export function getVerkoopPerArtikel(data: SligroData) {
  return data.verkoop_periodes.per_artikel;
}

export function getBufferOverride(data: SligroData, artikelnummer: string): number {
  return data.buffer_overrides[artikelnummer] ?? 1;
}

export function getVoorraadStuksMap(data: SligroData): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [artikelnummer, item] of Object.entries(data.voorraad)) {
    map[artikelnummer] = item.aantal_stuks;
  }
  return map;
}
