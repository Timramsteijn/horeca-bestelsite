import { parseGetal, vindKolom } from "./csv";
import type { KoppeltabelRow } from "../types/sligro";

const NAAM_PATRONEN = [/product/i, /artikel/i, /item/i];
const AANTAL_PATRONEN = [/aantal/i, /qty/i, /quantity/i, /verkocht/i, /sold/i, /count/i, /amount/i];
const PID_PATROON = /^pid$/i;

export interface LightspeedRij {
  pid: string | null;
  naam: string;
  aantal: number;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 30).join("\n");
  const semicolons = (sample.match(/;/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
}

/** Zoekt de kopregel (naam- + aantalkolom via regex), leest regels tot de
 * eerstvolgende lege regel of het einde van het bestand. */
export function parseLightspeedReport(text: string): LightspeedRij[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const delimiter = detectDelimiter(lines);

  let headerIndex = -1;
  let naamKolom = -1;
  let aantalKolom = -1;
  let pidKolom = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitLine(lines[i], delimiter);
    const n = vindKolom(cells, NAAM_PATRONEN);
    const a = vindKolom(cells, AANTAL_PATRONEN);
    if (n !== -1 && a !== -1 && n !== a) {
      headerIndex = i;
      naamKolom = n;
      aantalKolom = a;
      pidKolom = vindKolom(cells, [PID_PATROON]);
      break;
    }
  }

  if (headerIndex === -1) return [];

  const rijen: LightspeedRij[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) break;
    const cells = splitLine(lines[i], delimiter);
    const naam = cells[naamKolom]?.trim();
    const aantal = parseGetal(cells[aantalKolom] ?? "");
    if (!naam || aantal === null) continue;
    rijen.push({
      pid: pidKolom !== -1 ? cells[pidKolom]?.trim() || null : null,
      naam,
      aantal,
    });
  }
  return rijen;
}

/** Leest de "from: ... to: ..."-regels bovenaan een Lightspeed
 * PRODUCT SUMMARY REPORT en zet ze om naar een periodelabel + aantal weken. */
export function extractPeriode(text: string): { label: string; weken: number } | null {
  const fromMatch = text.match(/from:\s*(\d{1,2})-(\d{1,2})-(\d{2,4})/i);
  const toMatch = text.match(/to:\s*(\d{1,2})-(\d{1,2})-(\d{2,4})/i);
  if (!fromMatch || !toMatch) return null;

  const toIso = (m: RegExpMatchArray) => {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  const fromIso = toIso(fromMatch);
  const toIsoStr = toIso(toMatch);
  const dagen = (new Date(toIsoStr).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(dagen) || dagen <= 0) return null;

  return { label: `${fromIso} - ${toIsoStr}`, weken: dagen / 7 };
}

export interface VerkoopImportResultaat {
  // artikelnummer -> totaal verkochte stuks
  perArtikel: Record<string, number>;
  nietGekoppeld: { naam: string; aantal: number }[];
  mixArtikelen: { naam: string; aantal: number }[];
}

function eersteTweeWoorden(naam: string): string {
  return naam.toLowerCase().trim().split(/\s+/).slice(0, 2).join(" ");
}

/** Matcht via koppeltabel: eerst exacte PID-match, dan exacte naam-match, dan
 * gedeeltelijke match op de eerste twee woorden. "mix"-regels worden niet
 * automatisch verdeeld (daar is geen rekenregel voor gegeven) en komen apart
 * terug zodat ze handmatig verwerkt kunnen worden. */
export function matchLightspeedRijen(
  rijen: LightspeedRij[],
  koppeltabel: KoppeltabelRow[],
): VerkoopImportResultaat {
  const byPid = new Map(koppeltabel.map((k) => [k.pid, k]));
  const byNaam = new Map(koppeltabel.map((k) => [k.productnaam.toLowerCase().trim(), k]));
  const byEersteTweeWoorden = new Map(
    koppeltabel.map((k) => [eersteTweeWoorden(k.productnaam), k]),
  );

  const perArtikel: Record<string, number> = {};
  const nietGekoppeld: { naam: string; aantal: number }[] = [];
  const mixArtikelen: { naam: string; aantal: number }[] = [];

  for (const rij of rijen) {
    const match =
      (rij.pid ? byPid.get(rij.pid) : undefined) ??
      byNaam.get(rij.naam.toLowerCase().trim()) ??
      byEersteTweeWoorden.get(eersteTweeWoorden(rij.naam));

    if (!match || match.status === "nvt") {
      if (match?.status !== "nvt") nietGekoppeld.push({ naam: rij.naam, aantal: rij.aantal });
      continue;
    }
    if (match.status === "mix") {
      mixArtikelen.push({ naam: rij.naam, aantal: rij.aantal });
      continue;
    }
    perArtikel[match.artikelnummer] = (perArtikel[match.artikelnummer] ?? 0) + rij.aantal;
  }

  return { perArtikel, nietGekoppeld, mixArtikelen };
}
