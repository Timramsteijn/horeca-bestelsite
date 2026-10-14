import { useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import {
  berekenInkoopadvies,
  DEFAULT_BUFFER_PCT,
  DEFAULT_WEKEN_VOORUIT,
} from "../lib/inkoopadvies";
import { EmptyState } from "./EmptyState";
import { useSligroData } from "../hooks/useSligroData";
import { useSligroStore } from "../lib/store";
import { getVoorraadItems } from "../lib/data";

// Beheer-scherm voor seizoenen: hier kun je élk seizoen altijd bewerken
// (niet alleen het actieve), seizoenen activeren/deactiveren, hernoemen en
// verwijderen. De Inkoopadvies-tab zelf houdt alleen de snelle "welk seizoen
// geldt nu"-kiezer.
export function SeizoenenTab() {
  const data = useSligroData();
  const maakSeizoen = useSligroStore((s) => s.maakSeizoen);
  const updateSeizoen = useSligroStore((s) => s.updateSeizoen);
  const verwijderSeizoen = useSligroStore((s) => s.verwijderSeizoen);
  const setDoelvoorraad = useSligroStore((s) => s.setDoelvoorraad);
  const activeerSeizoen = useSligroStore((s) => s.activeerSeizoen);

  const [nieuwSeizoenNaam, setNieuwSeizoenNaam] = useState("");
  const [opengeklapt, setOpengeklapt] = useState<string | null>(null);
  const [hernoemId, setHernoemId] = useState<string | null>(null);
  const [hernoemWaarde, setHernoemWaarde] = useState("");

  const voorraadItems = useMemo(() => (data ? getVoorraadItems(data) : []), [data]);
  const zekereArtikelen = useMemo(() => voorraadItems.filter((i) => i.status === "zeker"), [voorraadItems]);

  // Automatische berekening (laatste periode, standaardinstellingen) als
  // startpunt voor een nieuw seizoen en als referentie in de tabel.
  const automatisch = useMemo(() => {
    if (!data) return [];
    const laatstePeriode = data.verkoop_periodes.periodes.at(-1)?.label;
    return berekenInkoopadvies(
      zekereArtikelen,
      data.verkoop_periodes.per_artikel,
      data.verkoop_periodes.periodes,
      data.buffer_overrides,
      {},
      {
        periodeLabels: laatstePeriode ? [laatstePeriode] : [],
        wekenVooruit: data.instellingen.weken_vooruit ?? DEFAULT_WEKEN_VOORUIT,
        bufferPct: data.instellingen.buffer_pct ?? DEFAULT_BUFFER_PCT,
      },
    );
  }, [data, zekereArtikelen]);

  if (!data) return <EmptyState message="Data laden…" />;

  const seizoenen = data.seizoenen;

  function seizoenAanmaken() {
    const naam = nieuwSeizoenNaam.trim();
    if (!naam) return;
    const snapshot: Record<string, number> = {};
    for (const r of automatisch) snapshot[r.artikelnummer] = r.vaste_voorraad_verpakkingen;
    const id = maakSeizoen(naam, snapshot);
    setNieuwSeizoenNaam("");
    setOpengeklapt(id);
  }

  function seizoenVerwijderen(id: string, naam: string) {
    if (!window.confirm(`Seizoen "${naam}" verwijderen?`)) return;
    verwijderSeizoen(id);
    if (opengeklapt === id) setOpengeklapt(null);
  }

  function hernoemStarten(id: string, huidigeNaam: string) {
    setHernoemId(id);
    setHernoemWaarde(huidigeNaam);
  }

  function hernoemOpslaan() {
    if (!hernoemId) return;
    const naam = hernoemWaarde.trim();
    if (naam) updateSeizoen(hernoemId, { naam });
    setHernoemId(null);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
        <p className="kicker text-[11px] text-text-muted">
          Seizoenen zijn handmatig ingestelde vaste-voorraadaantallen per artikel, als alternatief
          voor de automatische berekening in Inkoopadvies. Activeer hier welk seizoen daar geldt —
          elk seizoen blijft altijd bewerkbaar, ook als het niet actief is.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={nieuwSeizoenNaam}
            onChange={(e) => setNieuwSeizoenNaam(e.target.value)}
            placeholder="Naam nieuw seizoen, bv. Winter"
            className="w-56 rounded-[8px] border border-border-light bg-white px-3 py-1.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="button"
            disabled={!nieuwSeizoenNaam.trim()}
            onClick={seizoenAanmaken}
            className="motion kicker rounded-[999px] border border-border-light bg-white px-3 py-1.5 text-[11px] text-text-medium hover:border-accent disabled:opacity-45"
          >
            Seizoen aanmaken (vanuit automatische berekening)
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
        <div>
          <p className="text-[13px] font-semibold text-ink">Automatisch</p>
          <p className="text-[12px] text-text-muted">Inkoopadvies berekent de vaste voorraad zelf.</p>
        </div>
        <button
          type="button"
          onClick={() => activeerSeizoen(null)}
          aria-pressed={data.actief_seizoen_id === null}
          className={`motion kicker inline-flex items-center gap-1.5 rounded-[999px] border px-3.5 py-2 text-[11px] ${
            data.actief_seizoen_id === null
              ? "border-accent bg-accent text-accent-on"
              : "border-border-light bg-white text-text-medium hover:border-accent"
          }`}
        >
          {data.actief_seizoen_id === null && <Check size={14} strokeWidth={2} />}
          {data.actief_seizoen_id === null ? "Actief" : "Activeren"}
        </button>
      </div>

      {seizoenen.length === 0 ? (
        <EmptyState message="Nog geen seizoenen aangemaakt." />
      ) : (
        seizoenen.map((seizoen) => {
          const isActief = data.actief_seizoen_id === seizoen.id;
          const isOpen = opengeklapt === seizoen.id;
          return (
            <div
              key={seizoen.id}
              className="flex flex-col gap-3 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {hernoemId === seizoen.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={hernoemWaarde}
                    onChange={(e) => setHernoemWaarde(e.target.value)}
                    onBlur={hernoemOpslaan}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") hernoemOpslaan();
                      if (e.key === "Escape") setHernoemId(null);
                    }}
                    className="w-56 rounded-[8px] border border-accent bg-accent-tint px-2 py-1 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => hernoemStarten(seizoen.id, seizoen.naam)}
                    className="motion text-left text-[14px] font-semibold text-ink hover:underline"
                    title="Naam bewerken"
                  >
                    {seizoen.naam}
                  </button>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOpengeklapt(isOpen ? null : seizoen.id)}
                    className="motion kicker rounded-[999px] border border-border-light bg-white px-3 py-1.5 text-[11px] text-text-medium hover:border-accent"
                  >
                    {isOpen ? "Verbergen" : "Aantallen bewerken"}
                  </button>
                  <button
                    type="button"
                    onClick={() => activeerSeizoen(seizoen.id)}
                    aria-pressed={isActief}
                    className={`motion kicker inline-flex items-center gap-1.5 rounded-[999px] border px-3.5 py-1.5 text-[11px] ${
                      isActief
                        ? "border-accent bg-accent text-accent-on"
                        : "border-border-light bg-white text-text-medium hover:border-accent"
                    }`}
                  >
                    {isActief && <Check size={14} strokeWidth={2} />}
                    {isActief ? "Actief" : "Activeren"}
                  </button>
                  <button
                    type="button"
                    onClick={() => seizoenVerwijderen(seizoen.id, seizoen.naam)}
                    aria-label={`Seizoen ${seizoen.naam} verwijderen`}
                    className="motion flex h-8 w-8 items-center justify-center rounded-[999px] text-text-muted hover:bg-amber-tint hover:text-amber-text"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="overflow-x-auto rounded-[10px] border border-border-light">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border-light bg-zand/40">
                        <th className="px-3 py-2 text-[11px] font-semibold text-text-muted">Artikel</th>
                        <th className="px-3 py-2 text-[11px] font-semibold text-text-muted">Sligro-nr.</th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold text-text-muted">
                          Automatisch
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] font-semibold text-text-muted">
                          Doelvoorraad (verp.)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {zekereArtikelen.map((item) => {
                        const automatischeRegel = automatisch.find((r) => r.artikelnummer === item.artikelnummer);
                        const waarde =
                          seizoen.doelvoorraad[item.artikelnummer] ??
                          automatischeRegel?.vaste_voorraad_verpakkingen ??
                          0;
                        return (
                          <tr key={item.artikelnummer} className="border-b border-border-light last:border-b-0">
                            <td className="px-3 py-2 text-ink">{item.omschrijving}</td>
                            <td className="px-3 py-2 font-semibold text-text-medium">{item.artikelnummer}</td>
                            <td className="px-3 py-2 text-right text-text-muted">
                              {automatischeRegel?.vaste_voorraad_verpakkingen ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                value={waarde}
                                onChange={(e) =>
                                  setDoelvoorraad(
                                    seizoen.id,
                                    item.artikelnummer,
                                    Math.max(0, Number(e.target.value) || 0),
                                  )
                                }
                                className="w-20 rounded-[8px] border border-border-light bg-white px-2 py-1 text-right text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
