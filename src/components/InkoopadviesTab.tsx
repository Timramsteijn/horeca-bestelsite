import { useMemo, useState } from "react";
import type { KoppeltabelRow, VerkoopPerArtikel, VerkoopPeriode } from "../types/sligro";
import {
  berekenInkoopadvies,
  DEFAULT_BUFFER_PCT,
  DEFAULT_WEKEN_VOORUIT,
} from "../lib/inkoopadvies";
import { EmptyState } from "./EmptyState";

interface Props {
  koppeltabel: KoppeltabelRow[];
  voorraadStuks: Record<string, number>;
  verkoopPerArtikel: Record<string, VerkoopPerArtikel>;
  periodes: VerkoopPeriode[];
  bufferOverrides: Record<string, number>;
}

export function InkoopadviesTab({
  koppeltabel,
  voorraadStuks,
  verkoopPerArtikel,
  periodes,
  bufferOverrides,
}: Props) {
  const laatstePeriode = periodes.at(-1)?.label;
  const [selectedPeriodes, setSelectedPeriodes] = useState<string[]>(
    laatstePeriode ? [laatstePeriode] : [],
  );
  const [wekenVooruit, setWekenVooruit] = useState(DEFAULT_WEKEN_VOORUIT);
  const [bufferPctInput, setBufferPctInput] = useState(Math.round(DEFAULT_BUFFER_PCT * 100));

  const zekereArtikelen = useMemo(
    () => koppeltabel.filter((row) => row.status === "zeker"),
    [koppeltabel],
  );

  const resultaat = useMemo(
    () =>
      berekenInkoopadvies(koppeltabel, voorraadStuks, verkoopPerArtikel, periodes, bufferOverrides, {
        periodeLabels: selectedPeriodes,
        wekenVooruit,
        bufferPct: bufferPctInput / 100,
      }),
    [koppeltabel, voorraadStuks, verkoopPerArtikel, periodes, bufferOverrides, selectedPeriodes, wekenVooruit, bufferPctInput],
  );

  const teBestellenCount = resultaat.filter((r) => r.te_bestellen_verpakkingen > 0).length;

  if (periodes.length === 0 || zekereArtikelen.length === 0) {
    return (
      <EmptyState message="Geen verkoopdata of geen artikelen met status 'zeker' — er kan nog geen inkoopadvies berekend worden." />
    );
  }

  function togglePeriode(label: string) {
    setSelectedPeriodes((current) =>
      current.includes(label) ? current.filter((l) => l !== label) : [...current, label],
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-3.5 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
        <div>
          <p className="kicker mb-1.5 text-[11px] text-text-muted">Periode(s) voor gemiddelde verkoop</p>
          <div className="flex flex-wrap gap-1.5">
            {periodes.map((p) => {
              const isActive = selectedPeriodes.includes(p.label);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => togglePeriode(p.label)}
                  aria-pressed={isActive}
                  className={`motion kicker rounded-[999px] border px-3 py-1.5 text-[11px] ${
                    isActive
                      ? "border-accent bg-accent text-accent-on"
                      : "border-border-light bg-white text-text-medium hover:border-accent"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <label className="flex flex-col gap-1">
            <span className="kicker text-[11px] text-text-muted">Weken vooruit</span>
            <input
              type="number"
              min={1}
              step={1}
              value={wekenVooruit}
              onChange={(e) => setWekenVooruit(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="kicker text-[11px] text-text-muted">Buffer %</span>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={1}
                value={bufferPctInput}
                onChange={(e) => setBufferPctInput(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 rounded-[8px] border border-border-light bg-white px-3 py-2 pr-7 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">%</span>
            </div>
          </label>
        </div>
      </div>

      {selectedPeriodes.length === 0 ? (
        <EmptyState message="Selecteer minimaal één periode om een advies te berekenen." />
      ) : (
        <>
          <p className="text-[12px] text-text-muted">
            {teBestellenCount} van {resultaat.length} artikelen hebben een geadviseerde bestelling.
          </p>
          <div className="overflow-x-auto rounded-[10px] border border-border-light bg-white shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-zand/40">
                  <th className="kicker px-3 py-2.5 text-[10px] text-text-muted">Artikel</th>
                  <th className="kicker px-3 py-2.5 text-[10px] text-text-muted">Sligro-nr.</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Gem./week</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Par-niveau</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">
                    Vaste voorraad (verp. / stuks)
                  </th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Huidige voorraad</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Tekort</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Te bestellen (verp.)</th>
                </tr>
              </thead>
              <tbody>
                {resultaat.map((r) => (
                  <tr key={r.pid} className="border-b border-border-light last:border-b-0">
                    <td className="px-3 py-2 text-ink">{r.productnaam}</td>
                    <td className="px-3 py-2 font-semibold text-text-medium">{r.artikelnummer}</td>
                    <td className="px-3 py-2 text-right text-ink">{r.gem_verkoop_per_week.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-ink">{r.par_niveau}</td>
                    <td className="px-3 py-2 text-right text-ink">
                      {r.vaste_voorraad_verpakkingen} / {r.vaste_voorraad_stuks}
                    </td>
                    <td className="px-3 py-2 text-right text-ink">{r.huidige_voorraad}</td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${
                        r.tekort > 0 ? "text-amber-text" : "text-green-text"
                      }`}
                    >
                      {r.tekort}
                    </td>
                    <td className="display px-3 py-2 text-right text-[16px] text-ink">
                      {r.te_bestellen_verpakkingen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
