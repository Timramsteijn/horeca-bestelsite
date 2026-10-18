import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { KoppeltabelRow, KoppeltabelStatus } from "../types/sligro";
import { SearchInput } from "./SearchInput";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";
import { useSligroData } from "../hooks/useSligroData";
import { useSligroStore } from "../lib/store";
import { getKoppeltabel } from "../lib/data";

const FILTERS: { key: KoppeltabelStatus | "alle"; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "controleer", label: "Controleer" },
  { key: "mix", label: "Mix" },
  { key: "zeker", label: "Zeker" },
  { key: "nvt", label: "N.v.t." },
];

const STATUS_OPTIES: KoppeltabelStatus[] = ["zeker", "controleer", "mix", "nvt"];
const STATUS_LABEL: Record<KoppeltabelStatus, string> = {
  zeker: "Zeker",
  controleer: "Controleer",
  mix: "Mix",
  nvt: "N.v.t.",
};

interface RijFormWaarden {
  pid: string;
  productnaam: string;
  artikelnummer: string;
  omschrijving: string;
  aantal_per_verpakking: string;
  status: KoppeltabelStatus;
  notitie: string;
}

const LEEG_FORMULIER: RijFormWaarden = {
  pid: "",
  productnaam: "",
  artikelnummer: "",
  omschrijving: "",
  aantal_per_verpakking: "1",
  status: "controleer",
  notitie: "",
};

function RijFormulier({
  waarden,
  onWijzig,
  pidBewerkbaar,
}: {
  waarden: RijFormWaarden;
  onWijzig: (w: RijFormWaarden) => void;
  pidBewerkbaar: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <label className="flex flex-col gap-1">
        <span className="kicker text-[10px] text-text-muted">Lightspeed-PID</span>
        <input
          type="text"
          disabled={!pidBewerkbaar}
          value={waarden.pid}
          onChange={(e) => onWijzig({ ...waarden, pid: e.target.value })}
          className="w-28 rounded-[8px] border border-border-light bg-white px-2 py-1.5 text-[13px] text-ink disabled:bg-zand/50 disabled:text-text-muted"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="kicker text-[10px] text-text-muted">Lightspeed-artikel</span>
        <input
          type="text"
          value={waarden.productnaam}
          onChange={(e) => onWijzig({ ...waarden, productnaam: e.target.value })}
          className="w-44 rounded-[8px] border border-border-light bg-white px-2 py-1.5 text-[13px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="kicker text-[10px] text-text-muted">Sligro-nr.</span>
        <input
          type="text"
          value={waarden.artikelnummer}
          onChange={(e) => onWijzig({ ...waarden, artikelnummer: e.target.value })}
          className="w-28 rounded-[8px] border border-border-light bg-white px-2 py-1.5 text-[13px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="kicker text-[10px] text-text-muted">Omschrijving</span>
        <input
          type="text"
          value={waarden.omschrijving}
          onChange={(e) => onWijzig({ ...waarden, omschrijving: e.target.value })}
          className="w-44 rounded-[8px] border border-border-light bg-white px-2 py-1.5 text-[13px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="kicker text-[10px] text-text-muted">Per verpakking</span>
        <input
          type="number"
          min={1}
          value={waarden.aantal_per_verpakking}
          onChange={(e) => onWijzig({ ...waarden, aantal_per_verpakking: e.target.value })}
          className="w-20 rounded-[8px] border border-border-light bg-white px-2 py-1.5 text-right text-[13px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="kicker text-[10px] text-text-muted">Status</span>
        <select
          value={waarden.status}
          onChange={(e) => onWijzig({ ...waarden, status: e.target.value as KoppeltabelStatus })}
          className="rounded-[8px] border border-border-light bg-white px-2 py-1.5 text-[13px] text-ink"
        >
          {STATUS_OPTIES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="kicker text-[10px] text-text-muted">Notitie</span>
        <input
          type="text"
          value={waarden.notitie}
          onChange={(e) => onWijzig({ ...waarden, notitie: e.target.value })}
          className="w-36 rounded-[8px] border border-border-light bg-white px-2 py-1.5 text-[13px] text-ink"
        />
      </label>
    </div>
  );
}

function NieuweKoppelingSectie() {
  const voegKoppeltabelRijToe = useSligroStore((s) => s.voegKoppeltabelRijToe);
  const [open, setOpen] = useState(false);
  const [waarden, setWaarden] = useState<RijFormWaarden>(LEEG_FORMULIER);
  const [fout, setFout] = useState<string | null>(null);

  const geldig =
    waarden.pid.trim() !== "" &&
    waarden.artikelnummer.trim() !== "" &&
    Number(waarden.aantal_per_verpakking) > 0;

  function aanmaken() {
    if (!geldig) return;
    const gelukt = voegKoppeltabelRijToe({
      pid: waarden.pid.trim(),
      productnaam: waarden.productnaam.trim(),
      artikelnummer: waarden.artikelnummer.trim(),
      omschrijving: waarden.omschrijving.trim(),
      aantal_per_verpakking: Number(waarden.aantal_per_verpakking),
      status: waarden.status,
      notitie: waarden.notitie.trim(),
    });
    if (!gelukt) {
      setFout(`PID ${waarden.pid.trim()} bestaat al in de koppeltabel.`);
      return;
    }
    setWaarden(LEEG_FORMULIER);
    setFout(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="motion kicker inline-flex w-fit items-center gap-1.5 rounded-[999px] bg-accent px-3.5 py-2 text-[11px] text-accent-on"
      >
        <Plus size={16} strokeWidth={2} />
        Nieuwe koppeling toevoegen
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border-light bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="kicker text-[11px] text-text-muted">Nieuwe koppeling</p>
      <RijFormulier waarden={waarden} onWijzig={setWaarden} pidBewerkbaar />
      {fout && <p className="text-[12px] text-amber-text">{fout}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!geldig}
          onClick={aanmaken}
          className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on disabled:opacity-45"
        >
          Toevoegen
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setWaarden(LEEG_FORMULIER);
            setFout(null);
          }}
          className="motion kicker rounded-[999px] border border-border-light bg-white px-4 py-2 text-[11px] text-text-medium"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

function KoppeltabelRijWeergave({ row }: { row: KoppeltabelRow }) {
  const updateKoppeltabelRij = useSligroStore((s) => s.updateKoppeltabelRij);
  const verwijderKoppeltabelRij = useSligroStore((s) => s.verwijderKoppeltabelRij);
  const [bewerken, setBewerken] = useState(false);
  const [waarden, setWaarden] = useState<RijFormWaarden>({
    pid: row.pid,
    productnaam: row.productnaam,
    artikelnummer: row.artikelnummer,
    omschrijving: row.omschrijving,
    aantal_per_verpakking: String(row.aantal_per_verpakking),
    status: row.status,
    notitie: row.notitie,
  });

  function opslaan() {
    const aantal = Number(waarden.aantal_per_verpakking);
    if (!waarden.artikelnummer.trim() || !Number.isFinite(aantal) || aantal <= 0) return;
    updateKoppeltabelRij(row.pid, {
      productnaam: waarden.productnaam.trim(),
      artikelnummer: waarden.artikelnummer.trim(),
      omschrijving: waarden.omschrijving.trim(),
      aantal_per_verpakking: aantal,
      status: waarden.status,
      notitie: waarden.notitie.trim(),
    });
    setBewerken(false);
  }

  function annuleren() {
    setWaarden({
      pid: row.pid,
      productnaam: row.productnaam,
      artikelnummer: row.artikelnummer,
      omschrijving: row.omschrijving,
      aantal_per_verpakking: String(row.aantal_per_verpakking),
      status: row.status,
      notitie: row.notitie,
    });
    setBewerken(false);
  }

  function verwijderen() {
    if (window.confirm(`Koppeling voor "${row.productnaam || row.pid}" verwijderen?`)) {
      verwijderKoppeltabelRij(row.pid);
    }
  }

  if (bewerken) {
    return (
      <tr className="border-b border-border-light bg-zand/30 last:border-b-0">
        <td colSpan={7} className="px-4 py-3">
          <div className="flex flex-col gap-2.5">
            <RijFormulier waarden={waarden} onWijzig={setWaarden} pidBewerkbaar={false} />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={opslaan}
                className="motion kicker rounded-[999px] bg-accent px-3.5 py-1.5 text-[10px] text-accent-on"
              >
                Opslaan
              </button>
              <button
                type="button"
                onClick={annuleren}
                className="motion kicker rounded-[999px] border border-border-light bg-white px-3.5 py-1.5 text-[10px] text-text-medium"
              >
                Annuleren
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border-light last:border-b-0">
      <td className="px-4 py-2.5 text-ink">{row.productnaam}</td>
      <td className="px-4 py-2.5 font-semibold text-text-medium">{row.artikelnummer}</td>
      <td className="px-4 py-2.5 text-text-muted">{row.omschrijving}</td>
      <td className="px-4 py-2.5 text-right text-ink">{row.aantal_per_verpakking}</td>
      <td className="px-4 py-2.5">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-2.5 text-text-muted">{row.notitie || "—"}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setBewerken(true)}
            aria-label="Koppeling bewerken"
            className="motion flex h-7 w-7 items-center justify-center rounded-[999px] text-text-muted hover:bg-zand"
          >
            <Pencil size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={verwijderen}
            aria-label="Koppeling verwijderen"
            className="motion flex h-7 w-7 items-center justify-center rounded-[999px] text-text-muted hover:bg-amber-tint hover:text-amber-text"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function KoppeltabelTab() {
  const data = useSligroData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KoppeltabelStatus | "alle">("alle");
  const rows = useMemo(() => (data ? getKoppeltabel(data) : []), [data]);

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

  if (!data) return <EmptyState message="Data laden…" />;

  return (
    <div className="flex flex-col gap-3.5">
      <NieuweKoppelingSectie />

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

      {rows.length === 0 ? (
        <EmptyState message="Nog geen koppeltabel beschikbaar." />
      ) : filtered.length === 0 ? (
        <EmptyState message={`Geen artikelen gevonden voor '${query}'.`} />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border-light bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[860px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-border-light bg-zand/40">
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Lightspeed-artikel</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Sligro-nr.</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Omschrijving</th>
                <th className="kicker px-4 py-2.5 text-right text-[11px] text-text-muted">Per verpakking</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Status</th>
                <th className="kicker px-4 py-2.5 text-[11px] text-text-muted">Notitie</th>
                <th className="kicker px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <KoppeltabelRijWeergave key={row.pid} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
