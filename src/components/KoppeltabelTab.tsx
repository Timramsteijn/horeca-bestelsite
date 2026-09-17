import { useMemo, useState } from "react";
import type { KoppeltabelRow, KoppeltabelStatus } from "../types/sligro";
import { SearchInput } from "./SearchInput";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";

const FILTERS: { key: KoppeltabelStatus | "alle"; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "controleer", label: "Controleer" },
  { key: "mix", label: "Mix" },
  { key: "zeker", label: "Zeker" },
  { key: "nvt", label: "N.v.t." },
];

export function KoppeltabelTab({ rows }: { rows: KoppeltabelRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KoppeltabelStatus | "alle">("alle");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "alle" && row.status !== filter) return false;
      if (!q) return true;
      return (
        row.productnaam.toLowerCase().includes(q) ||
        row.artikelnummer.toLowerCase().includes(q) ||
        row.omschrijving.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  if (rows.length === 0) {
    return <EmptyState message="Nog geen koppeltabel beschikbaar." />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={isActive}
              className={`motion kicker rounded-[999px] border px-3 py-1.5 text-[11px] ${
                isActive
                  ? "border-accent bg-accent text-accent-on"
                  : "border-border-light bg-white text-text-medium hover:border-accent"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Zoek op artikel, omschrijving of Sligro-artikelnummer…"
        resultCount={filtered.length}
        totalCount={rows.length}
        noun="artikelen"
      />

      {filtered.length === 0 ? (
        <EmptyState message={`Geen artikelen gevonden voor '${query}'.`} />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border-light bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-border-light bg-zand/40">
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Lightspeed-artikel</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Sligro-nr.</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Omschrijving</th>
                <th className="kicker px-4 py-2.5 text-right text-[11px] text-text-muted">Per verpakking</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Status</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Notitie</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.pid} className="border-b border-border-light last:border-b-0">
                  <td className="px-4 py-2.5 text-ink">{row.productnaam}</td>
                  <td className="px-4 py-2.5 font-semibold text-text-medium">{row.artikelnummer}</td>
                  <td className="px-4 py-2.5 text-text-muted">{row.omschrijving}</td>
                  <td className="px-4 py-2.5 text-right text-ink">{row.aantal_per_verpakking}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{row.notitie || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
