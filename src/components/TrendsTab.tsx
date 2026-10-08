import { useSligroData } from "../hooks/useSligroData";
import { EmptyState } from "./EmptyState";

export function TrendsTab() {
  const data = useSligroData();
  if (!data) return <EmptyState message="Data laden…" />;

  const { periodes, per_artikel } = data.verkoop_periodes;

  const artikelen = Object.entries(per_artikel)
    .map(([artikelnummer, item]) => ({ artikelnummer, ...item }))
    .filter(({ artikelnummer }) => !data.voorraad[artikelnummer]?.arrangement_alleen)
    .sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, "nl"));

  if (periodes.length === 0 || artikelen.length === 0) {
    return <EmptyState message="Nog geen verkoopdata beschikbaar." />;
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-border-light bg-white shadow-[var(--shadow-card)]">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border-light bg-zand/40">
            <th className="kicker sticky left-0 bg-zand/40 px-4 py-2.5 text-[11px] text-text-muted">
              Artikel
            </th>
            <th className="kicker px-3 py-2.5 text-[11px] text-text-muted">Sligro-nr.</th>
            {periodes.map((p) => (
              <th
                key={p.label}
                className="kicker whitespace-nowrap px-3 py-2.5 text-right text-[11px] text-text-muted"
              >
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {artikelen.map((art) => (
            <tr key={art.artikelnummer} className="border-b border-border-light last:border-b-0">
              <td className="sticky left-0 bg-white px-4 py-2 text-ink">{art.omschrijving}</td>
              <td className="px-3 py-2 font-semibold text-text-medium">{art.artikelnummer}</td>
              {periodes.map((p) => {
                const waarde = art.verkoop_per_periode[p.label];
                return (
                  <td key={p.label} className="px-3 py-2 text-right text-ink">
                    {waarde === undefined ? "—" : Math.round(waarde)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
