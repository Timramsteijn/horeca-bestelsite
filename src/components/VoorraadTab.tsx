import { Fragment, useMemo, useRef, useState } from "react";
import { SearchInput } from "./SearchInput";
import { EmptyState } from "./EmptyState";
import { formatDate } from "../lib/format";
import { ChevronDown, ChevronRight, Download, ListChecks, Upload } from "lucide-react";
import { useSligroData } from "../hooks/useSligroData";
import { getVoorraadItems } from "../lib/data";
import { useSligroStore } from "../lib/store";
import { buildTelsheetCsv, parseTelsheetCsv } from "../lib/telsheet";
import { downloadCsv } from "../lib/csv";

const MUTATIE_LABEL: Record<string, string> = {
  telling: "Telling",
  levering: "Levering",
  verkoop: "Verkoop",
  correctie: "Correctie",
};

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VoorraadTab() {
  const data = useSligroData();
  const werkTellingBij = useSligroStore((s) => s.werkTellingBij);
  const werkTellingenBulkBij = useSligroStore((s) => s.werkTellingenBulkBij);

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bewerkRij, setBewerkRij] = useState<string | null>(null);
  const [bewerkWaarde, setBewerkWaarde] = useState("");
  const [bulkModus, setBulkModus] = useState(false);
  const [bulkWaarden, setBulkWaarden] = useState<Record<string, string>>({});
  const [importMelding, setImportMelding] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => (data ? getVoorraadItems(data) : []), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.omschrijving.toLowerCase().includes(q) || item.artikelnummer.toLowerCase().includes(q),
    );
  }, [items, query]);

  if (!data) return <EmptyState message="Data laden…" />;
  if (items.length === 0) {
    return <EmptyState message="Nog geen voorraadgegevens beschikbaar." />;
  }

  function startBewerken(artikelnummer: string, huidig: number) {
    setBewerkRij(artikelnummer);
    setBewerkWaarde(String(Math.round(huidig)));
  }

  function opslaanBewerken(artikelnummer: string) {
    const aantal = Number(bewerkWaarde);
    if (Number.isFinite(aantal) && aantal >= 0) {
      werkTellingBij(artikelnummer, aantal, vandaag(), `handmatige telling (${vandaag()})`);
    }
    setBewerkRij(null);
  }

  function opslaanBulk() {
    const datum = vandaag();
    const entries = Object.entries(bulkWaarden)
      .filter(([, v]) => v.trim() !== "")
      .map(([artikelnummer, v]) => ({ artikelnummer, aantal: Number(v) }))
      .filter((e) => Number.isFinite(e.aantal) && e.aantal >= 0);
    if (entries.length > 0) {
      werkTellingenBulkBij(entries, datum, `lijsttelling ${datum}`);
    }
    setBulkWaarden({});
    setBulkModus(false);
  }

  function exporteerTelsheet() {
    downloadCsv(`telsheet-${vandaag()}.csv`, buildTelsheetCsv(items));
  }

  async function importeerTelsheet(file: File) {
    const text = await file.text();
    const { regels, overgeslagen } = parseTelsheetCsv(text);
    if (regels.length > 0) {
      werkTellingenBulkBij(regels, vandaag(), `telsheet-import (${file.name})`);
    }
    setImportMelding(`${regels.length} regel(s) verwerkt, ${overgeslagen} overgeslagen.`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setBulkModus((v) => !v)}
          aria-pressed={bulkModus}
          className={`motion kicker inline-flex items-center gap-1.5 rounded-[999px] border px-3 py-1.5 text-[11px] ${
            bulkModus
              ? "border-accent bg-accent text-accent-on"
              : "border-border-light bg-white text-text-medium hover:border-accent"
          }`}
        >
          <ListChecks size={16} strokeWidth={2} />
          Hele lijst bijwerken
        </button>
        <button
          type="button"
          onClick={exporteerTelsheet}
          className="motion kicker inline-flex items-center gap-1.5 rounded-[999px] border border-border-light bg-white px-3 py-1.5 text-[11px] text-text-medium hover:border-accent"
        >
          <Download size={16} strokeWidth={2} />
          Telsheet exporteren
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="motion kicker inline-flex items-center gap-1.5 rounded-[999px] border border-border-light bg-white px-3 py-1.5 text-[11px] text-text-medium hover:border-accent"
        >
          <Upload size={16} strokeWidth={2} />
          Telsheet importeren
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importeerTelsheet(file);
          }}
        />
      </div>
      {importMelding && <p className="text-[12px] text-text-muted">{importMelding}</p>}

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Zoek op artikel of Sligro-artikelnummer…"
        resultCount={filtered.length}
        totalCount={items.length}
        noun="artikelen"
      />

      {filtered.length === 0 ? (
        <EmptyState message={`Geen artikelen gevonden voor '${query}'.`} />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border-light bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-border-light bg-zand/40">
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Artikel</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Sligro-nr.</th>
                <th className="kicker px-4 py-2.5 text-right text-[11px] text-text-muted">Voorraad</th>
                <th className="kicker hidden desktop:table-cell px-4 py-2.5 text-[11px] text-text-muted">
                  Bijgewerkt
                </th>
                <th className="kicker hidden desktop:table-cell px-4 py-2.5 text-[11px] text-text-muted">
                  Telling
                </th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">
                  {bulkModus ? "Nieuwe telling" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isOpen = expanded === item.artikelnummer;
                const isBewerken = bewerkRij === item.artikelnummer;
                return (
                  <Fragment key={item.artikelnummer}>
                    <tr className="motion border-b border-border-light last:border-b-0 hover:bg-zand/40">
                      <td
                        className="cursor-pointer px-4 py-2.5"
                        onClick={() => !bulkModus && setExpanded(isOpen ? null : item.artikelnummer)}
                      >
                        <div className="flex items-center gap-1.5">
                          {!bulkModus &&
                            (isOpen ? (
                              <ChevronDown size={16} strokeWidth={2} className="shrink-0 text-text-muted" />
                            ) : (
                              <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-text-muted" />
                            ))}
                          <span className="text-ink">{item.omschrijving}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-text-medium">
                        {item.artikelnummer}
                      </td>
                      <td className="display px-4 py-2.5 text-right text-[18px] text-ink">
                        {Math.round(item.aantal_stuks)}
                      </td>
                      <td className="hidden desktop:table-cell px-4 py-2.5 text-text-muted">
                        {formatDate(item.laatst_bijgewerkt)}
                      </td>
                      <td className="hidden desktop:table-cell px-4 py-2.5 text-text-muted">
                        {formatDate(item.laatste_telling)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {bulkModus ? (
                          <input
                            type="number"
                            min={0}
                            placeholder="—"
                            value={bulkWaarden[item.artikelnummer] ?? ""}
                            onChange={(e) =>
                              setBulkWaarden((w) => ({ ...w, [item.artikelnummer]: e.target.value }))
                            }
                            className="w-20 rounded-[8px] border border-border-light px-2 py-1 text-right text-[13px] focus-visible:outline-2 focus-visible:outline-accent"
                          />
                        ) : isBewerken ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min={0}
                              autoFocus
                              value={bewerkWaarde}
                              onChange={(e) => setBewerkWaarde(e.target.value)}
                              className="w-20 rounded-[8px] border border-border-light px-2 py-1 text-right text-[13px] focus-visible:outline-2 focus-visible:outline-accent"
                            />
                            <button
                              type="button"
                              onClick={() => opslaanBewerken(item.artikelnummer)}
                              className="motion kicker rounded-[999px] bg-accent px-2.5 py-1 text-[10px] text-accent-on"
                            >
                              Opslaan
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startBewerken(item.artikelnummer, item.aantal_stuks)}
                            className="motion kicker rounded-[999px] border border-border-light px-2.5 py-1 text-[10px] text-text-medium hover:border-accent"
                          >
                            Bijwerken
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && !bulkModus && (
                      <tr className="border-b border-border-light bg-zand/30 last:border-b-0">
                        <td colSpan={6} className="px-4 py-3">
                          {item.mutaties.length === 0 ? (
                            <p className="text-[13px] text-text-muted">Geen mutatiehistorie bekend.</p>
                          ) : (
                            <ul className="flex flex-col gap-1.5">
                              {item.mutaties.map((m, i) => (
                                <li
                                  key={i}
                                  className="flex flex-wrap items-baseline gap-2 text-[13px] text-text-medium"
                                >
                                  <span className="kicker rounded-[999px] bg-neutral-fill px-2 py-0.5 text-[10px] text-text-muted">
                                    {MUTATIE_LABEL[m.soort] ?? m.soort}
                                  </span>
                                  <span className="text-text-muted">{formatDate(m.datum)}</span>
                                  <span
                                    className={
                                      m.delta < 0
                                        ? "font-semibold text-red-text"
                                        : "font-semibold text-green-text"
                                    }
                                  >
                                    {m.delta > 0 ? "+" : ""}
                                    {m.delta}
                                  </span>
                                  <span className="text-text-muted">{m.bron}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {bulkModus && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={opslaanBulk}
            className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on"
          >
            Telling opslaan
          </button>
        </div>
      )}
    </div>
  );
}
