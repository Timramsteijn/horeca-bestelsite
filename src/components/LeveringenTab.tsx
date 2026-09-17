import type { Levering } from "../types/sligro";
import { EmptyState } from "./EmptyState";
import { formatDate } from "../lib/format";

function VerwerktBadge({ verwerkt }: { verwerkt: boolean }) {
  return (
    <span
      className={`kicker inline-flex items-center rounded-[999px] px-2.5 py-1 text-[10px] ${
        verwerkt ? "bg-green-tint text-green-text" : "bg-amber-tint text-amber-text"
      }`}
    >
      {verwerkt ? "Verwerkt" : "Open"}
    </span>
  );
}

function LeveringCard({ levering }: { levering: Levering }) {
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-ink">{levering.referentie}</span>
          <span className="text-[12px] text-text-muted">
            Besteld {formatDate(levering.besteld_op)}
            {levering.leverdatum ? ` · Geleverd ${formatDate(levering.leverdatum)}` : " · Nog niet geleverd"}
          </span>
        </div>
        <VerwerktBadge verwerkt={levering.verwerkt} />
      </div>

      <div className="overflow-x-auto rounded-[8px] border border-border-light">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border-light bg-zand/40">
              <th className="kicker px-3 py-2 text-[10px] text-text-muted">Artikel</th>
              <th className="kicker px-3 py-2 text-right text-[10px] text-text-muted">
                Geadviseerd (verp. / stuks)
              </th>
              <th className="kicker px-3 py-2 text-right text-[10px] text-text-muted">
                Ontvangen (verp. / stuks)
              </th>
            </tr>
          </thead>
          <tbody>
            {levering.artikelen.map((art) => (
              <tr key={art.artikelnummer} className="border-b border-border-light last:border-b-0">
                <td className="px-3 py-2 text-ink">
                  {art.omschrijving}
                  <span className="ml-1.5 text-text-muted">#{art.artikelnummer}</span>
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {art.aantal_geadviseerd} / {art.aantal_geadviseerd * art.aantal_per_verpakking}
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {art.aantal_ontvangen} / {art.aantal_ontvangen * art.aantal_per_verpakking}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LeveringenTab({ leveringen }: { leveringen: Levering[] }) {
  if (leveringen.length === 0) {
    return <EmptyState message="Nog geen leveringen geregistreerd." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {leveringen.map((levering) => (
        <LeveringCard key={`${levering.referentie}-${levering.besteld_op}`} levering={levering} />
      ))}
    </div>
  );
}
