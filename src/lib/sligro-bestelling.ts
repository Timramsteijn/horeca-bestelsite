import { buildCsv } from "./csv";

// Kolomvolgorde/namen zijn een aanname — bevestig dit tegen het echte Sligro-
// importformaat voordat dit productie-klaar is (zie README "open punten").
export interface BestellijstRegel {
  artikelnummer: string;
  omschrijving: string;
  aantal_verpakkingen: number;
  aantal_stuks: number;
}

export function buildSligroBestellingCsv(regels: BestellijstRegel[]): string {
  const rows: (string | number)[][] = [
    ["artikelnummer", "omschrijving", "aantal_verpakkingen", "aantal_stuks"],
    ...regels.map((r) => [r.artikelnummer, r.omschrijving, r.aantal_verpakkingen, r.aantal_stuks]),
  ];
  return buildCsv(rows);
}
