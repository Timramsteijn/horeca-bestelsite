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
import type { Arrangement, ArrangementStatus, Boeking } from "../types/sligro";
import { RecrasImportKnop } from "./RecrasImportKnop";
import { formatDate } from "../lib/format";

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

const HORIZON_LABEL: Record<BoekingStatus, string> = {
  geweest: "Geweest",
  telt_mee: "Telt mee in advies",
  later: "Later",
};
const HORIZON_CLASS: Record<BoekingStatus, string> = {
  geweest: "bg-neutral-fill text-text-muted",
  telt_mee: "bg-green-tint text-green-text",
  later: "bg-keuring-tint text-keuring-text",
};

const STATUS_OPTIES: ArrangementStatus[] = ["zeker", "controleer", "nvt"];
const STATUS_LABEL_KORT: Record<ArrangementStatus, string> = {
  zeker: "Zeker",
  controleer: "Controleer",
  nvt: "N.v.t.",
};
const STATUS_ACTIVE_CLASS: Record<ArrangementStatus, string> = {
  zeker: "bg-green-tint text-green-text",
  controleer: "bg-amber-tint text-amber-text",
  nvt: "bg-neutral-fill text-text-medium",
};
const STATUS_UITLEG: Record<ArrangementStatus, string> = {
  zeker: "Telt mee in het inkoopadvies",
  controleer: "Sligro-verbruik nog invullen — telt nog niet mee",
  nvt: "Hoort niet bij bestellen — telt nooit mee",
};

const RECRAS_STATUS_LABEL: Record<Boeking["status"], string> = {
  definitief: "Definitief",
  optie: "Optie",
  voltooid: "Voltooid",
};
const RECRAS_STATUS_CLASS: Record<Boeking["status"], string> = {
  definitief: "bg-green-tint text-green-text",
  optie: "bg-amber-tint text-amber-text",
  voltooid: "bg-neutral-fill text-text-muted",
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

function NieuweBoekingForm({ arrangementen }: { arrangementen: Arrangement[] }) {
  const voegBoekingToe = useSligroStore((s) => s.voegBoekingToe);
  const [arrangementId, setArrangementId] = useState("");
  const [datum, setDatum] = useState(vandaag());
  const [personen, setPersonen] = useState("");

  const geldig = arrangementId !== "" && datum !== "" && Number(personen) > 0;

  function toevoegen() {
    if (!geldig) return;
    const sjabloon = arrangementen.find((a) => a.id === arrangementId);
    if (!sjabloon) return;
    voegBoekingToe({
      arrangement_id: arrangementId,
      product_naam: sjabloon.naam,
      datum,
      aantal_personen: Number(personen),
      bron: "handmatig",
      recras_boeking: null,
      boekingsnaam: null,
      status: "definitief",
    });
    setArrangementId("");
    setDatum(vandaag());
    setPersonen("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="kicker text-[11px] text-text-muted">Handmatig een boeking toevoegen</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="kicker text-[10px] text-text-muted">Productsjabloon</span>
          <select
            value={arrangementId}
            onChange={(e) => setArrangementId(e.target.value)}
            className="min-w-[200px] rounded-[8px] border border-border-light bg-white px-3 py-2 text-[14px] text-ink"
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

function BoekingRegelRij({
  boeking,
  arrangementen,
  wekenVooruit,
}: {
  boeking: Boeking;
  arrangementen: Arrangement[];
  wekenVooruit: number;
}) {
  const updateBoeking = useSligroStore((s) => s.updateBoeking);
  const verwijderBoeking = useSligroStore((s) => s.verwijderBoeking);
  const arrangement = arrangementen.find((a) => a.id === boeking.arrangement_id);
  const horizonStatus = bepaalBoekingStatus(boeking.datum, vandaag(), wekenVooruit);
  const consumptie = berekenBoekingConsumptie(boeking, arrangement);
  const { totaalStuks, aantalArtikelen } = samenvatBoekingConsumptie(consumptie);

  return (
    <tr className="border-b border-border-light last:border-b-0">
      <td className="px-3 py-2 text-ink">
        <p>{boeking.product_naam}</p>
        <select
          value={boeking.arrangement_id ?? ""}
          onChange={(e) => updateBoeking(boeking.id, { arrangement_id: e.target.value || null })}
          className={`mt-1 rounded-[8px] border px-2 py-1 text-[12px] ${
            boeking.arrangement_id ? "border-border-light text-text-muted" : "border-amber-text bg-amber-tint text-amber-text"
          }`}
        >
          <option value="">— nog niet gekoppeld —</option>
          {arrangementen.map((a) => (
            <option key={a.id} value={a.id}>
              {a.naam}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right text-ink">
        <Stepper
          value={boeking.aantal_personen}
          min={1}
          onChange={(v) => updateBoeking(boeking.id, { aantal_personen: v })}
        />
      </td>
      <td className="px-3 py-2 text-ink">{formatDate(boeking.datum)}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <span className={`kicker rounded-[999px] px-2 py-0.5 text-[10px] ${RECRAS_STATUS_CLASS[boeking.status]}`}>
            {RECRAS_STATUS_LABEL[boeking.status]}
          </span>
          <span className={`kicker rounded-[999px] px-2 py-0.5 text-[10px] ${HORIZON_CLASS[horizonStatus]}`}>
            {HORIZON_LABEL[horizonStatus]}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-right text-text-muted">
        {aantalArtikelen > 0 ? `${Math.round(totaalStuks * 100) / 100} stuks (${aantalArtikelen} art.)` : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => verwijderBoeking(boeking.id)}
          className="motion flex h-7 w-7 items-center justify-center rounded-[999px] text-text-muted hover:bg-amber-tint hover:text-amber-text"
          aria-label="Boekingsregel verwijderen"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </td>
    </tr>
  );
}

interface BoekingenGroep {
  sleutel: string;
  boekingsnaam: string | null;
  recras_boeking: string | null;
  regels: Boeking[];
}

function groepeerBoekingen(boekingen: Boeking[]): BoekingenGroep[] {
  const map = new Map<string, BoekingenGroep>();
  for (const b of boekingen) {
    const sleutel = b.recras_boeking ?? `handmatig-${b.id}`;
    let groep = map.get(sleutel);
    if (!groep) {
      groep = { sleutel, boekingsnaam: b.boekingsnaam, recras_boeking: b.recras_boeking, regels: [] };
      map.set(sleutel, groep);
    }
    groep.regels.push(b);
  }
  return Array.from(map.values()).sort((a, b) => {
    const minDatum = (g: BoekingenGroep) => g.regels.reduce((min, r) => (r.datum < min ? r.datum : min), g.regels[0].datum);
    return minDatum(a).localeCompare(minDatum(b));
  });
}

function BoekingenGroepKaart({
  groep,
  arrangementen,
  wekenVooruit,
}: {
  groep: BoekingenGroep;
  arrangementen: Arrangement[];
  wekenVooruit: number;
}) {
  const gesorteerd = useMemo(
    () => [...groep.regels].sort((a, b) => a.datum.localeCompare(b.datum)),
    [groep.regels],
  );

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-ink">{groep.boekingsnaam || "Handmatige boeking"}</p>
          {groep.recras_boeking && (
            <p className="kicker text-[10px] text-text-muted">RECRAS-boeking {groep.recras_boeking}</p>
          )}
        </div>
        <p className="text-[12px] text-text-muted">{groep.regels.length} productregel(s)</p>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-border-light">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border-light bg-zand/40">
              <th className="px-3 py-2 text-[11px] font-semibold text-text-muted">Product</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-text-muted">Aantal</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-text-muted">Datum</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-text-muted">Status</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-text-muted">Verbruik</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((b) => (
              <BoekingRegelRij key={b.id} boeking={b} arrangementen={arrangementen} wekenVooruit={wekenVooruit} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BoekingenSectie({
  boekingen,
  arrangementen,
  wekenVooruit,
}: {
  boekingen: Boeking[];
  arrangementen: Arrangement[];
  wekenVooruit: number;
}) {
  const groepen = useMemo(() => groepeerBoekingen(boekingen), [boekingen]);
  const ongekoppeld = boekingen.filter((b) => b.arrangement_id === null).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="display text-[20px] text-ink">Boekingen</h2>
        <RecrasImportKnop arrangementen={arrangementen} />
      </div>
      {ongekoppeld > 0 && (
        <p className="rounded-[8px] bg-amber-tint px-3 py-2 text-[12px] text-amber-text">
          {ongekoppeld} productregel(s) nog niet gekoppeld aan een sjabloon — kies er hieronder één, of maak eerst
          een sjabloon aan.
        </p>
      )}
      {arrangementen.length === 0 ? (
        <EmptyState message="Maak eerst een productsjabloon aan (hieronder) voordat je handmatig kunt boeken." />
      ) : (
        <NieuweBoekingForm arrangementen={arrangementen} />
      )}
      {groepen.length === 0 ? (
        <EmptyState message="Nog geen boekingen. Importeer een RECRAS-overzicht of voeg er handmatig één toe." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {groepen.map((g) => (
            <BoekingenGroepKaart key={g.sleutel} groep={g} arrangementen={arrangementen} wekenVooruit={wekenVooruit} />
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
  tally,
}: {
  arrangement: Arrangement;
  voorraad: Record<string, { omschrijving: string }>;
  tally: { aantalBoekingen: number; aantalPersonen: number } | undefined;
}) {
  const updateArrangement = useSligroStore((s) => s.updateArrangement);
  const verwijderArrangement = useSligroStore((s) => s.verwijderArrangement);
  const [hernoemen, setHernoemen] = useState(false);
  const [naamWaarde, setNaamWaarde] = useState(arrangement.naam);

  function naamOpslaan() {
    const naam = naamWaarde.trim();
    if (naam) updateArrangement(arrangement.id, { naam });
    setHernoemen(false);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] bg-navy p-4 text-creme">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {hernoemen ? (
            <input
              type="text"
              autoFocus
              value={naamWaarde}
              onChange={(e) => setNaamWaarde(e.target.value)}
              onBlur={naamOpslaan}
              onKeyDown={(e) => {
                if (e.key === "Enter") naamOpslaan();
                if (e.key === "Escape") {
                  setNaamWaarde(arrangement.naam);
                  setHernoemen(false);
                }
              }}
              className="w-full rounded-[8px] border border-border-dark bg-navy-light px-2 py-1 text-[15px] text-creme"
            />
          ) : (
            <button
              type="button"
              onClick={() => setHernoemen(true)}
              className="motion truncate text-left text-[15px] font-semibold text-creme hover:underline"
              title="Naam bewerken — moet overeenkomen met de RECRAS-productnaam om te matchen"
            >
              {arrangement.naam}
            </button>
          )}
          <p className="kicker text-[10px] text-text-on-dark">
            Per persoon
            {tally && tally.aantalBoekingen > 0 && (
              <> · {tally.aantalBoekingen}× geboekt, {tally.aantalPersonen} personen</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => verwijderArrangement(arrangement.id)}
          className="motion flex h-8 w-8 shrink-0 items-center justify-center rounded-[999px] text-text-on-dark hover:bg-navy-light"
          aria-label="Productsjabloon verwijderen"
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => updateArrangement(arrangement.id, { status })}
            aria-pressed={arrangement.status === status}
            className={`motion kicker rounded-[999px] px-2.5 py-1 text-[10px] ${
              arrangement.status === status
                ? STATUS_ACTIVE_CLASS[status]
                : "bg-navy-light text-text-on-dark hover:bg-border-dark"
            }`}
          >
            {STATUS_LABEL_KORT[status]}
          </button>
        ))}
      </div>
      <p className="kicker text-[10px] text-text-on-dark">{STATUS_UITLEG[arrangement.status]}</p>

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
      <p className="kicker text-[11px] text-text-muted">Nieuw productsjabloon</p>
      <input
        type="text"
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder="Naam, exact zoals in RECRAS"
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

const FILTER_OPTIES: (ArrangementStatus | "alles")[] = ["alles", "zeker", "controleer", "nvt"];
const FILTER_LABEL: Record<ArrangementStatus | "alles", string> = {
  alles: "Alles",
  zeker: "Zeker",
  controleer: "Controleer",
  nvt: "N.v.t.",
};

export function ArrangementenTab() {
  const data = useSligroData();
  const arrangementen = data?.arrangementen ?? [];
  const boekingen = data?.boekingen ?? [];
  const voorraad = data?.voorraad ?? {};
  const instellingen = data?.instellingen;
  const [filter, setFilter] = useState<ArrangementStatus | "alles">("alles");

  const tallyPerArrangement = useMemo(() => {
    const tally = new Map<string, { aantalBoekingen: number; aantalPersonen: number }>();
    for (const b of boekingen) {
      if (!b.arrangement_id) continue;
      const bestaand = tally.get(b.arrangement_id) ?? { aantalBoekingen: 0, aantalPersonen: 0 };
      bestaand.aantalBoekingen += 1;
      bestaand.aantalPersonen += b.aantal_personen;
      tally.set(b.arrangement_id, bestaand);
    }
    return tally;
  }, [boekingen]);

  // Meest gebruikte sjablonen bovenaan — zo zie je in één oogopslag welke
  // het meest de moeite waard zijn om het Sligro-verbruik voor in te vullen.
  const gefilterd = (filter === "alles" ? arrangementen : arrangementen.filter((a) => a.status === filter))
    .slice()
    .sort((a, b) => (tallyPerArrangement.get(b.id)?.aantalBoekingen ?? 0) - (tallyPerArrangement.get(a.id)?.aantalBoekingen ?? 0));

  if (!data || !instellingen) return <EmptyState message="Data laden…" />;

  return (
    <div className="flex flex-col gap-6">
      <BoekingenSectie boekingen={boekingen} arrangementen={arrangementen} wekenVooruit={instellingen.weken_vooruit} />

      <div className="flex flex-col gap-3">
        <h2 className="display text-[20px] text-ink">Productsjablonen</h2>
        <p className="text-[12px] text-text-muted">
          Eén sjabloon per boekbaar RECRAS-product, met het Sligro-verbruik per persoon. De naam moet exact
          overeenkomen met de productnaam in RECRAS om bij een import automatisch gekoppeld te worden. Niet elk
          RECRAS-"product" is iets om Sligro-spullen voor te bestellen — zet zulke producten op "N.v.t.".
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIES.map((optie) => {
            const aantal = optie === "alles" ? arrangementen.length : arrangementen.filter((a) => a.status === optie).length;
            return (
              <button
                key={optie}
                type="button"
                onClick={() => setFilter(optie)}
                aria-pressed={filter === optie}
                className={`motion kicker rounded-[999px] border px-3 py-1.5 text-[11px] ${
                  filter === optie
                    ? "border-accent bg-accent text-accent-on"
                    : "border-border-light bg-white text-text-medium hover:border-accent"
                }`}
              >
                {FILTER_LABEL[optie]} ({aantal})
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {gefilterd.map((a) => (
            <ArrangementKaart key={a.id} arrangement={a} voorraad={voorraad} tally={tallyPerArrangement.get(a.id)} />
          ))}
          {filter === "alles" && <NieuwArrangementKaart />}
        </div>
      </div>
    </div>
  );
}
