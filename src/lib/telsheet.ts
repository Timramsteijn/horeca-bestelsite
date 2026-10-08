import { buildCsv, parseCsv, parseGetal, vindKolom } from "./csv";
import type { VoorraadItem } from "../types/sligro";

export function buildTelsheetCsv(items: VoorraadItem[]): string {
  const rows: (string | number)[][] = [
    ["sligro_artikelnummer", "artikel", "huidige_voorraad", "getelde_voorraad"],
    ...items.map((item) => [item.artikelnummer, item.omschrijving, item.aantal_stuks, ""]),
  ];
  return buildCsv(rows);
}

export interface TelsheetRegel {
  artikelnummer: string;
  aantal: number;
}

export interface TelsheetImportResultaat {
  regels: TelsheetRegel[];
  overgeslagen: number;
}

export function parseTelsheetCsv(text: string): TelsheetImportResultaat {
  const { rows } = parseCsv(text);
  if (rows.length === 0) return { regels: [], overgeslagen: 0 };

  const header = rows[0].map((h) => h.toLowerCase());
  const artikelKolom = vindKolom(header, [/artikelnummer/, /sligro/]);
  const geteldKolom = vindKolom(header, [/geteld/, /telling/, /nieuw/]);

  if (artikelKolom === -1 || geteldKolom === -1) {
    return { regels: [], overgeslagen: rows.length - 1 };
  }

  const regels: TelsheetRegel[] = [];
  let overgeslagen = 0;
  for (const row of rows.slice(1)) {
    const artikelnummer = row[artikelKolom]?.trim();
    const aantal = parseGetal(row[geteldKolom] ?? "");
    if (!artikelnummer || aantal === null) {
      overgeslagen++;
      continue;
    }
    regels.push({ artikelnummer, aantal });
  }
  return { regels, overgeslagen };
}
