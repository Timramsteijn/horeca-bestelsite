// Generieke CSV-hulpfuncties: delimiter-detectie (; of ,), BOM-strip, quoted
// fields, en kop-detectie op regex. Gebruikt door telsheet-export/import,
// Sligro-bestelling-export en Lightspeed-verkoopimport.

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(firstLine: string): "," | ";" {
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export interface ParsedCsv {
  delimiter: string;
  rows: string[][];
}

/** Parset ruwe CSV-tekst naar rijen van cellen. Laat lege regels weg. */
export function parseCsv(text: string): ParsedCsv {
  const clean = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { delimiter: ";", rows: [] };
  const delimiter = detectDelimiter(lines[0]);
  return { delimiter, rows: lines.map((l) => parseLine(l, delimiter)) };
}

/** Nederlandse notatie (komma als decimaalteken, bv. "12,5" of "1.234,56")
 * én gewone dotnotatie (zoals Lightspeed-exports, bv. "12.5"). Een komma in
 * de waarde is doorslaggevend: dan is elke punt een duizendtal-scheiding. */
export function parseGetal(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Zoekt de kolomindex waarvan de header matcht met één van de patronen. */
export function vindKolom(header: string[], patterns: RegExp[]): number {
  return header.findIndex((h) => patterns.some((p) => p.test(h)));
}

export function toCsvField(value: string): string {
  if (/[;,"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Bouwt CSV-tekst (met UTF-8 BOM, puntkomma-gescheiden) uit rijen van cellen. */
export function buildCsv(rows: (string | number)[][], delimiter = ";"): string {
  const body = rows.map((row) => row.map((cell) => toCsvField(String(cell))).join(delimiter)).join("\n");
  return "﻿" + body + "\n";
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
