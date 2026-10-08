import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Printer, Download, X } from "lucide-react";
import {
  berekenInkoopadvies,
  DEFAULT_BUFFER_PCT,
  DEFAULT_WEKEN_VOORUIT,
  type InkoopadviesRegel,
} from "../lib/inkoopadvies";
import { berekenBenodigdUitArrangementen } from "../lib/arrangementen";
import { EmptyState } from "./EmptyState";
import { useSligroData } from "../hooks/useSligroData";
import { getVoorraadItems } from "../lib/data";
import { downloadCsv } from "../lib/csv";
import { buildSligroBestellingCsv, type BestellijstRegel } from "../lib/sligro-bestelling";
import { formatDate } from "../lib/format";

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

function BestellijstModal({
  regels,
  datum,
  onClose,
}: {
  regels: BestellijstRegel[];
  datum: string;
  onClose: () => void;
}) {
  const totaalVerpakkingen = regels.reduce((s, r) => s + r.aantal_verpakkingen, 0);
  const totaalStuks = regels.reduce((s, r) => s + r.aantal_stuks, 0);

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 no-print">
      <div className="print-area flex w-full max-w-[720px] flex-col gap-4 rounded-[18px] bg-white p-5 shadow-[var(--shadow-hover)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="display text-[22px] text-ink">Bestellijst</h2>
            <p className="text-[13px] text-text-muted">
              {formatDate(datum)} · {regels.length} regels · {totaalVerpakkingen} verpakkingen ·{" "}
              {totaalStuks} stuks · leverancier Sligro
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="motion no-print flex h-8 w-8 shrink-0 items-center justify-center rounded-[999px] text-text-muted hover:bg-zand"
            aria-label="Sluiten"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-x-auto rounded-[10px] border border-border-light">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border-light bg-zand/40">
                <th className="px-3 py-2 text-[11px] font-semibold text-text-muted">Artikel</th>
                <th className="px-3 py-2 text-[11px] font-semibold text-text-muted">Sligro-nr.</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-text-muted">Verp.</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-text-muted">Stuks</th>
              </tr>
            </thead>
            <tbody>
              {regels.map((r) => (
                <tr key={r.artikelnummer} className="border-b border-border-light last:border-b-0">
                  <td className="px-3 py-2 text-ink">{r.omschrijving}</td>
                  <td className="px-3 py-2 font-semibold text-text-medium">{r.artikelnummer}</td>
                  <td className="px-3 py-2 text-right text-ink">{r.aantal_verpakkingen}</td>
                  <td className="px-3 py-2 text-right text-ink">{r.aantal_stuks}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-light font-semibold">
                <td className="px-3 py-2 text-ink" colSpan={2}>
                  Totaal
                </td>
                <td className="px-3 py-2 text-right text-ink">{totaalVerpakkingen}</td>
                <td className="px-3 py-2 text-right text-ink">{totaalStuks}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap gap-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="motion kicker inline-flex items-center gap-1.5 rounded-[999px] border border-border-light bg-white px-3.5 py-2 text-[11px] text-text-medium hover:border-accent"
          >
            <Printer size={16} strokeWidth={2} />
            Afdrukken
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(`sligro-bestelling-${datum}.csv`, buildSligroBestellingCsv(regels))}
            className="motion kicker inline-flex items-center gap-1.5 rounded-[999px] bg-accent px-3.5 py-2 text-[11px] text-accent-on"
          >
            <Download size={16} strokeWidth={2} />
            CSV voor Sligro downloaden
          </button>
        </div>
      </div>
    </div>
  );
}

function WerkelijkeBestellingStepper({
  waarde,
  onChange,
}: {
  waarde: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, waarde - 1))}
        className="motion flex h-6 w-6 items-center justify-center rounded-[999px] border border-border-light text-text-medium hover:border-accent"
        aria-label="Verlagen"
      >
        <Minus size={12} strokeWidth={2} />
      </button>
      <span className="display w-7 text-center text-[15px] text-ink">{waarde}</span>
      <button
        type="button"
        onClick={() => onChange(waarde + 1)}
        className="motion flex h-6 w-6 items-center justify-center rounded-[999px] border border-border-light text-text-medium hover:border-accent"
        aria-label="Verhogen"
      >
        <Plus size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

export function InkoopadviesTab() {
  const data = useSligroData();
  const periodes = data?.verkoop_periodes.periodes ?? [];
  const laatstePeriode = periodes.at(-1)?.label;
  const [selectedPeriodes, setSelectedPeriodes] = useState<string[]>(
    laatstePeriode ? [laatstePeriode] : [],
  );
  const [wekenVooruit, setWekenVooruit] = useState(data?.instellingen.weken_vooruit ?? DEFAULT_WEKEN_VOORUIT);
  const [bufferPctInput, setBufferPctInput] = useState(
    Math.round((data?.instellingen.buffer_pct ?? DEFAULT_BUFFER_PCT) * 100),
  );
  const [werkelijkeOverrides, setWerkelijkeOverrides] = useState<Record<string, number>>({});
  const [toonBestellijst, setToonBestellijst] = useState(false);

  // Data wordt asynchroon geladen (eerste render heeft data===null), dus de
  // standaardwaarden hierboven zijn dan nog niet bekend — zodra de data
  // binnenkomt, zet dit eenmalig de standaard periode/instellingen.
  const geinitialiseerd = useRef(false);
  useEffect(() => {
    if (!data || geinitialiseerd.current) return;
    geinitialiseerd.current = true;
    if (laatstePeriode) setSelectedPeriodes([laatstePeriode]);
    setWekenVooruit(data.instellingen.weken_vooruit);
    setBufferPctInput(Math.round(data.instellingen.buffer_pct * 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const voorraadItems = useMemo(() => (data ? getVoorraadItems(data) : []), [data]);
  const zekereArtikelen = useMemo(() => voorraadItems.filter((i) => i.status === "zeker"), [voorraadItems]);

  const benodigdUitArrangementen = useMemo(() => {
    if (!data) return {};
    return berekenBenodigdUitArrangementen(
      data.boekingen,
      data.arrangementen,
      data.opties,
      vandaag(),
      wekenVooruit,
    );
  }, [data, wekenVooruit]);

  const resultaat = useMemo(() => {
    if (!data) return [];
    return berekenInkoopadvies(
      voorraadItems,
      data.verkoop_periodes.per_artikel,
      periodes,
      data.buffer_overrides,
      benodigdUitArrangementen,
      { periodeLabels: selectedPeriodes, wekenVooruit, bufferPct: bufferPctInput / 100 },
    );
  }, [data, voorraadItems, periodes, benodigdUitArrangementen, selectedPeriodes, wekenVooruit, bufferPctInput]);

  function werkelijkeBestelling(r: InkoopadviesRegel): number {
    return werkelijkeOverrides[r.artikelnummer] ?? r.te_bestellen_verpakkingen;
  }

  const teBestellenCount = resultaat.filter((r) => werkelijkeBestelling(r) > 0).length;
  const bestellijstRegels: BestellijstRegel[] = useMemo(
    () =>
      resultaat
        .filter((r) => werkelijkeBestelling(r) > 0)
        .map((r) => ({
          artikelnummer: r.artikelnummer,
          omschrijving: r.omschrijving,
          aantal_verpakkingen: werkelijkeBestelling(r),
          aantal_stuks: werkelijkeBestelling(r) * r.verpakkingsgrootte,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resultaat, werkelijkeOverrides],
  );
  const totaalTeBestellenVerpakkingen = bestellijstRegels.reduce((s, r) => s + r.aantal_verpakkingen, 0);

  if (!data) return <EmptyState message="Data laden…" />;

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-text-muted">
              {teBestellenCount} van {resultaat.length} artikelen hebben een geadviseerde bestelling.
            </p>
            <button
              type="button"
              disabled={totaalTeBestellenVerpakkingen === 0}
              onClick={() => setToonBestellijst(true)}
              className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on disabled:opacity-45"
            >
              Bestellijst maken · {totaalTeBestellenVerpakkingen} verp.
            </button>
          </div>
          <div className="overflow-x-auto rounded-[10px] border border-border-light bg-white shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-zand/40">
                  <th className="kicker px-3 py-2.5 text-[10px] text-text-muted">Artikel</th>
                  <th className="kicker px-3 py-2.5 text-[10px] text-text-muted">Sligro-nr.</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Gem./week</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Par-niveau</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Vaste voorraad</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">
                    Arrangementen (extra)
                  </th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Huidig</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Tekort</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">Advies</th>
                  <th className="kicker px-3 py-2.5 text-right text-[10px] text-text-muted">
                    Werkelijke bestelling
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultaat.map((r) => (
                  <tr key={r.artikelnummer} className="border-b border-border-light last:border-b-0">
                    <td className="px-3 py-2 text-ink">{r.omschrijving}</td>
                    <td className="px-3 py-2 font-semibold text-text-medium">{r.artikelnummer}</td>
                    <td className="px-3 py-2 text-right text-ink">{r.gem_verkoop_per_week.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-ink">{r.par_niveau}</td>
                    <td className="px-3 py-2 text-right text-ink">
                      {r.vaste_voorraad_verpakkingen} / {r.vaste_voorraad_stuks}
                    </td>
                    <td className="px-3 py-2 text-right text-ink">
                      {r.benodigd_uit_arrangementen > 0 ? `+${r.benodigd_uit_arrangementen}` : "—"}
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
                    <td className="px-3 py-2 text-right">
                      <WerkelijkeBestellingStepper
                        waarde={werkelijkeBestelling(r)}
                        onChange={(v) =>
                          setWerkelijkeOverrides((o) => ({ ...o, [r.artikelnummer]: v }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {toonBestellijst && (
        <BestellijstModal regels={bestellijstRegels} datum={vandaag()} onClose={() => setToonBestellijst(false)} />
      )}
    </div>
  );
}
