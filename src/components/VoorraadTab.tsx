import { Fragment, useMemo, useState } from "react";
import type { VoorraadItem } from "../types/sligro";
import { SearchInput } from "./SearchInput";
import { EmptyState } from "./EmptyState";
import { formatDate } from "../lib/format";
import { ChevronDown, ChevronRight } from "lucide-react";

const MUTATIE_LABEL: Record<string, string> = {
  telling: "Telling",
  levering: "Levering",
  verkoop: "Verkoop",
  correctie: "Correctie",
};

export function VoorraadTab({ items }: { items: VoorraadItem[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.omschrijving.toLowerCase().includes(q) || item.artikelnummer.toLowerCase().includes(q),
    );
  }, [items, query]);

  if (items.length === 0) {
    return <EmptyState message="Nog geen voorraadgegevens beschikbaar." />;
  }

  return (
    <div className="flex flex-col gap-3.5">
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
          <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-border-light bg-zand/40">
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Artikel</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Sligro-nr.</th>
                <th className="kicker px-4 py-2.5 text-right text-[11px] text-text-muted">Voorraad</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Bijgewerkt</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Telling</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isOpen = expanded === item.artikelnummer;
                return (
                  <Fragment key={item.artikelnummer}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : item.artikelnummer)}
                      className="motion cursor-pointer border-b border-border-light last:border-b-0 hover:bg-zand/40"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {isOpen ? (
                            <ChevronDown size={16} strokeWidth={2} className="shrink-0 text-text-muted" />
                          ) : (
                            <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-text-muted" />
                          )}
                          <span className="text-ink">{item.omschrijving}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-text-medium">
                        {item.artikelnummer}
                      </td>
                      <td className="display px-4 py-2.5 text-right text-[18px] text-ink">
                        {Math.round(item.aantal_stuks)}
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{formatDate(item.laatst_bijgewerkt)}</td>
                      <td className="px-4 py-2.5 text-text-muted">{formatDate(item.laatste_telling)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border-light bg-zand/30 last:border-b-0">
                        <td colSpan={5} className="px-4 py-3">
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
                                  <span className={m.delta < 0 ? "font-semibold text-red-text" : "font-semibold text-green-text"}>
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
    </div>
  );
}
