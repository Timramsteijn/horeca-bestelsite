import { useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useSligroData } from "../hooks/useSligroData";
import { useSligroStore } from "../lib/store";
import { EmptyState } from "./EmptyState";
import {
  bepaalBoekingStatus,
  berekenBoekingConsumptie,
  samenvatBoekingConsumptie,
  type BoekingStatus,
} from "../lib/arrangementen";
import type { Arrangement, Boeking, Optie } from "../types/sligro";

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<BoekingStatus, string> = {
  geweest: "Geweest",
  telt_mee: "Telt mee in advies",
  later: "Later",
};
const STATUS_CLASS: Record<BoekingStatus, string> = {
  geweest: "bg-neutral-fill text-text-muted",
  telt_mee: "bg-green-tint text-green-text",
  later: "bg-keuring-tint text-keuring-text",
};

function Stepper({
  value,
  onChange,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="motion flex h-7 w-7 items-center justify-center rounded-[999px] border border-border-light text-text-medium hover:border-accent"
        aria-label="Verlagen"
      >
        <Minus size={14} strokeWidth={2} />
      </button>
      <span className="display w-8 text-center text-[16px] text-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        className="motion flex h-7 w-7 items-center justify-center rounded-[999px] border border-border-light text-text-medium hover:border-accent"
        aria-label="Verhogen"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function NieuweBoekingForm({
  arrangementen,
  opties,
}: {
  arrangementen: Arrangement[];
  opties: Optie[];
}) {
  const voegBoekingToe = useSligroStore((s) => s.voegBoekingToe);
  const [arrangementId, setArrangementId] = useState("");
  const [datum, setDatum] = useState(vandaag());
  const [personen, setPersonen] = useState("");
  const [optieWaarden, setOptieWaarden] = useState<Record<string, string>>({});

  const geldig = arrangementId !== "" && datum !== "" && Number(personen) > 0;

  function toevoegen() {
    if (!geldig) return;
    const optiesOut: Record<string, number> = {};
    for (const [id, v] of Object.entries(optieWaarden)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) optiesOut[id] = n;
    }
    voegBoekingToe({ arrangement_id: arrangementId, datum, aantal_personen: Number(personen), opties: optiesOut });
    setArrangementId("");
    setDatum(vandaag());
    setPersonen("");
    setOptieWaarden({});
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="kicker text-[11px] text-text-muted">Nieuwe boeking</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="kicker text-[10px] text-text-muted">Arrangement</span>
          <select
            value={arrangementId}
            onChange={(e) => setArrangementId(e.target.value)}
            className="min-w-[160px] rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink"
          >
            <option value="">Kies…</option>
            {arrangementen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.naam}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="kicker text-[10px] text-text-muted">Datum</span>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="kicker text-[10px] text-text-muted">Personen</span>
          <input
            type="number"
            min={1}
            value={personen}
            onChange={(e) => setPersonen(e.target.value)}
            className="w-24 rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink"
          />
        </label>
        {opties.map((optie) => (
          <label key={optie.id} className="flex flex-col gap-1">
            <span className="kicker text-[10px] text-text-muted">Waarvan {optie.naam}</span>
            <input
              type="number"
              min={0}
              value={optieWaarden[optie.id] ?? ""}
              onChange={(e) => setOptieWaarden((w) => ({ ...w, [optie.id]: e.target.value }))}
              className="w-24 rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink"
            />
          </label>
        ))}
        <button
          type="button"
          disabled={!geldig}
          onClick={toevoegen}
          className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on disabled:opacity-45"
        >
          Toevoegen
        </button>
      </div>
    </div>
  );
}

function BoekingRij({
  boeking,
  arrangementen,
  opties,
  wekenVooruit,
}: {
  boeking: Boeking;
  arrangementen: Arrangement[];
  opties: Optie[];
  wekenVooruit: number;
}) {
  const updateBoeking = useSligroStore((s) => s.updateBoeking);
  const verwijderBoeking = useSligroStore((s) => s.verwijderBoeking);
  const arrangement = arrangementen.find((a) => a.id === boeking.arrangement_id);
  const status = bepaalBoekingStatus(boeking.datum, vandaag(), wekenVooruit);
  const consumptie = berekenBoekingConsumptie(boeking, arrangement, opties);
  const { totaalStuks, aantalArtikelen } = samenvatBoekingConsumptie(consumptie);
  const optieTotaal = Object.values(boeking.opties).reduce((a, b) => a + b, 0);
  const regulier = boeking.aantal_personen - optieTotaal;

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[15px] font-semibold text-ink">{arrangement?.naam ?? "(verwijderd arrangement)"}</span>
          <input
            type="date"
            value={boeking.datum}
            onChange={(e) => updateBoeking(boeking.id, { datum: e.target.value })}
            className="rounded-[8px] border border-border-light bg-white px-2 py-1 text-[13px] text-ink"
          />
          <span className={`kicker rounded-[999px] px-2.5 py-1 text-[10px] ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => verwijderBoeking(boeking.id)}
          className="motion flex h-8 w-8 items-center justify-center rounded-[999px] text-text-muted hover:bg-amber-tint hover:text-amber-text"
          aria-label="Boeking verwijderen"
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="kicker text-[10px] text-text-muted">Totaal personen</span>
          <Stepper
            value={boeking.aantal_personen}
            min={1}
            onChange={(v) => updateBoeking(boeking.id, { aantal_personen: v })}
          />
        </div>
        {opties.map((optie) => (
          <div key={optie.id} className="flex flex-col gap-1">
            <span className="kicker text-[10px] text-text-muted">Waarvan {optie.naam}</span>
            <Stepper
              value={boeking.opties[optie.id] ?? 0}
              min={0}
              max={boeking.aantal_personen}
              onChange={(v) =>
                updateBoeking(boeking.id, { opties: { ...boeking.opties, [optie.id]: v } })
              }
            />
          </div>
        ))}
      </div>

      <p className="text-[12px] text-text-muted">
        {boeking.aantal_personen} personen
        {optieTotaal > 0 && (
          <>
            {" ("}
            {opties
              .filter((o) => (boeking.opties[o.id] ?? 0) > 0)
              .map((o) => `${o.naam.toLowerCase()}: ${boeking.opties[o.id]}`)
              .join(", ")}
            {` en ${regulier} regulier)`}
          </>
        )}
        {" · "}
        {Math.round(totaalStuks * 100) / 100} stuks over {aantalArtikelen} artikelen
      </p>
    </div>
  );
}

function BoekingenSectie({
  boekingen,
  arrangementen,
  opties,
  wekenVooruit,
}: {
  boekingen: Boeking[];
  arrangementen: Arrangement[];
  opties: Optie[];
  wekenVooruit: number;
}) {
  const gesorteerd = useMemo(() => [...boekingen].sort((a, b) => a.datum.localeCompare(b.datum)), [boekingen]);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="display text-[20px] text-ink">Geboekte arrangementen</h2>
      {arrangementen.length === 0 ? (
        <EmptyState message="Maak eerst een arrangement aan (hieronder) voordat je kunt boeken." />
      ) : (
        <NieuweBoekingForm arrangementen={arrangementen} opties={opties} />
      )}
      {gesorteerd.length === 0 ? (
        <EmptyState message="Nog geen boekingen." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {gesorteerd.map((b) => (
            <BoekingRij
              key={b.id}
              boeking={b}
              arrangementen={arrangementen}
              opties={opties}
              wekenVooruit={wekenVooruit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArtikelKiezer({
  voorraad,
  onKies,
}: {
  voorraad: Record<string, { omschrijving: string }>;
  onKies: (sligronummer: string) => void;
}) {
  const [waarde, setWaarde] = useState("");
  const opties = useMemo(
    () =>
      Object.entries(voorraad)
        .map(([nr, v]) => ({ nr, naam: v.omschrijving }))
        .sort((a, b) => a.naam.localeCompare(b.naam, "nl")),
    [voorraad],
  );
  return (
    <select
      value={waarde}
      onChange={(e) => {
        if (e.target.value) {
          onKies(e.target.value);
          setWaarde("");
        }
      }}
      className="w-full rounded-[8px] border border-border-light bg-white px-3 py-2 text-[13px] text-ink"
    >
      <option value="">+ Product toevoegen…</option>
      {opties.map((o) => (
        <option key={o.nr} value={o.nr}>
          {o.naam} (#{o.nr})
        </option>
      ))}
    </select>
  );
}

function ArrangementKaart({
  arrangement,
  voorraad,
}: {
  arrangement: Arrangement;
  voorraad: Record<string, { omschrijving: string }>;
}) {
  const updateArrangement = useSligroStore((s) => s.updateArrangement);
  const verwijderArrangement = useSligroStore((s) => s.verwijderArrangement);

  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] bg-navy p-4 text-creme">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-creme">{arrangement.naam}</p>
          <p className="kicker text-[10px] text-text-on-dark">Per persoon</p>
        </div>
        <button
          type="button"
          onClick={() => verwijderArrangement(arrangement.id)}
          className="motion flex h-8 w-8 items-center justify-center rounded-[999px] text-text-on-dark hover:bg-navy-light"
          aria-label="Arrangement verwijderen"
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {arrangement.items.map((item, i) => (
          <div key={item.sligronummer} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-creme">{voorraad[item.sligronummer]?.omschrijving ?? item.sligronummer}</p>
              <p className="text-[11px] text-text-on-dark">#{item.sligronummer}</p>
            </div>
            <input
              type="number"
              min={0}
              step={0.1}
              value={item.per_persoon}
              onChange={(e) => {
                const items = [...arrangement.items];
                items[i] = { ...item, per_persoon: Number(e.target.value) };
                updateArrangement(arrangement.id, { items });
              }}
              className="w-20 rounded-[8px] border border-border-dark bg-navy-light px-2 py-1 text-right text-[13px] text-creme"
            />
            <button
              type="button"
              onClick={() =>
                updateArrangement(arrangement.id, {
                  items: arrangement.items.filter((_, idx) => idx !== i),
                })
              }
              className="motion flex h-7 w-7 items-center justify-center rounded-[999px] text-text-on-dark hover:bg-navy-light"
              aria-label="Product verwijderen"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <ArtikelKiezer
        voorraad={voorraad}
        onKies={(nr) =>
          updateArrangement(arrangement.id, {
            items: [...arrangement.items, { sligronummer: nr, per_persoon: 1 }],
          })
        }
      />
    </div>
  );
}

function NieuwArrangementKaart() {
  const maakArrangement = useSligroStore((s) => s.maakArrangement);
  const [naam, setNaam] = useState("");
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-dashed border-border-light bg-white p-4">
      <p className="kicker text-[11px] text-text-muted">Nieuw arrangement</p>
      <input
        type="text"
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder="Naam, bv. BBQ"
        className="rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink"
      />
      <button
        type="button"
        disabled={!naam.trim()}
        onClick={() => {
          maakArrangement(naam.trim());
          setNaam("");
        }}
        className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on disabled:opacity-45"
      >
        Aanmaken
      </button>
    </div>
  );
}

function OptieKaart({
  optie,
  voorraad,
  vervangKandidaten,
}: {
  optie: Optie;
  voorraad: Record<string, { omschrijving: string }>;
  vervangKandidaten: { nr: string; naam: string }[];
}) {
  const updateOptie = useSligroStore((s) => s.updateOptie);
  const verwijderOptie = useSligroStore((s) => s.verwijderOptie);

  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-ink">{optie.naam}</p>
          <p className="kicker text-[10px] text-text-muted">Per persoon</p>
        </div>
        <button
          type="button"
          onClick={() => verwijderOptie(optie.id)}
          className="motion flex h-8 w-8 items-center justify-center rounded-[999px] text-text-muted hover:bg-amber-tint hover:text-amber-text"
          aria-label="Optie verwijderen"
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {optie.items.map((item, i) => (
          <div key={item.sligronummer} className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink">{voorraad[item.sligronummer]?.omschrijving ?? item.sligronummer}</p>
              <p className="text-[11px] text-text-muted">#{item.sligronummer}</p>
            </div>
            <select
              value={item.vervangt ?? ""}
              onChange={(e) => {
                const items = [...optie.items];
                items[i] = { ...item, vervangt: e.target.value || null };
                updateOptie(optie.id, { items });
              }}
              className="rounded-[8px] border border-border-light bg-white px-2 py-1 text-[12px] text-ink"
            >
              <option value="">Vervangt niets (extra)</option>
              {vervangKandidaten.map((k) => (
                <option key={k.nr} value={k.nr}>
                  Vervangt: {k.naam}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={0.1}
              value={item.per_persoon}
              onChange={(e) => {
                const items = [...optie.items];
                items[i] = { ...item, per_persoon: Number(e.target.value) };
                updateOptie(optie.id, { items });
              }}
              className="w-20 rounded-[8px] border border-border-light bg-white px-2 py-1 text-right text-[13px] text-ink"
            />
            <button
              type="button"
              onClick={() => updateOptie(optie.id, { items: optie.items.filter((_, idx) => idx !== i) })}
              className="motion flex h-7 w-7 items-center justify-center rounded-[999px] text-text-muted hover:bg-amber-tint hover:text-amber-text"
              aria-label="Product verwijderen"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <ArtikelKiezer
        voorraad={voorraad}
        onKies={(nr) =>
          updateOptie(optie.id, { items: [...optie.items, { sligronummer: nr, per_persoon: 1, vervangt: null }] })
        }
      />
    </div>
  );
}

function NieuweOptieKaart() {
  const maakOptie = useSligroStore((s) => s.maakOptie);
  const [naam, setNaam] = useState("");
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-dashed border-border-light bg-white p-4">
      <p className="kicker text-[11px] text-text-muted">Nieuwe optie</p>
      <input
        type="text"
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder="Naam, bv. Halal"
        className="rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink"
      />
      <button
        type="button"
        disabled={!naam.trim()}
        onClick={() => {
          maakOptie(naam.trim());
          setNaam("");
        }}
        className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on disabled:opacity-45"
      >
        Aanmaken
      </button>
    </div>
  );
}

export function ArrangementenTab() {
  const data = useSligroData();
  const arrangementen = data?.arrangementen ?? [];
  const opties = data?.opties ?? [];
  const boekingen = data?.boekingen ?? [];
  const voorraad = data?.voorraad ?? {};
  const instellingen = data?.instellingen;

  const vervangKandidaten = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of arrangementen) {
      for (const item of a.items) {
        map.set(item.sligronummer, voorraad[item.sligronummer]?.omschrijving ?? item.sligronummer);
      }
    }
    return Array.from(map.entries())
      .map(([nr, naam]) => ({ nr, naam }))
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  }, [arrangementen, voorraad]);

  if (!data || !instellingen) return <EmptyState message="Data laden…" />;

  return (
    <div className="flex flex-col gap-6">
      <BoekingenSectie
        boekingen={boekingen}
        arrangementen={arrangementen}
        opties={opties}
        wekenVooruit={instellingen.weken_vooruit}
      />

      <div className="flex flex-col gap-3">
        <h2 className="display text-[20px] text-ink">Standaard arrangementen</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {arrangementen.map((a) => (
            <ArrangementKaart key={a.id} arrangement={a} voorraad={voorraad} />
          ))}
          <NieuwArrangementKaart />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="display text-[20px] text-ink">Extra opties</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {opties.map((o) => (
            <OptieKaart key={o.id} optie={o} voorraad={voorraad} vervangKandidaten={vervangKandidaten} />
          ))}
          <NieuweOptieKaart />
        </div>
      </div>
    </div>
  );
}
