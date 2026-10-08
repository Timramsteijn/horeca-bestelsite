import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useSligroData } from "../hooks/useSligroData";
import { useSligroStore } from "../lib/store";
import { extractPeriode, matchLightspeedRijen, parseLightspeedReport } from "../lib/lightspeed-import";
import { formatDateTime } from "../lib/format";

interface ImportMelding {
  type: "success" | "error";
  tekst: string;
}

export function HeaderBar({ title }: { title: string }) {
  const data = useSligroData();
  const verwerkVerkoopImport = useSligroStore((s) => s.verwerkVerkoopImport);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<ImportMelding | null>(null);

  async function handleFile(file: File) {
    setBezig(true);
    setMelding(null);
    try {
      const text = await file.text();
      const periode = extractPeriode(text);
      if (!periode) {
        setMelding({ type: "error", tekst: "Geen periode (from/to) gevonden in dit rapport." });
        return;
      }
      if (!data) return;
      const rijen = parseLightspeedReport(text);
      if (rijen.length === 0) {
        setMelding({ type: "error", tekst: "Geen productregels gevonden in dit rapport." });
        return;
      }
      const { perArtikel, nietGekoppeld, mixArtikelen } = matchLightspeedRijen(rijen, data.koppeltabel);
      const vandaag = new Date().toISOString().slice(0, 10);
      verwerkVerkoopImport(periode.label, periode.weken, perArtikel, vandaag);

      const delen = [`Periode ${periode.label} verwerkt voor ${Object.keys(perArtikel).length} artikelen.`];
      if (mixArtikelen.length > 0) {
        delen.push(`${mixArtikelen.length} mix-artikelen niet automatisch verdeeld (handmatig verwerken).`);
      }
      if (nietGekoppeld.length > 0) {
        delen.push(`${nietGekoppeld.length} regels niet gekoppeld (buiten scope of nieuw).`);
      }
      setMelding({ type: "success", tekst: delen.join(" ") });
    } catch (e) {
      setMelding({ type: "error", tekst: e instanceof Error ? e.message : "Onbekende fout bij importeren." });
    } finally {
      setBezig(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const importKnop = (
    <>
      <button
        type="button"
        disabled={bezig || !data}
        onClick={() => fileInputRef.current?.click()}
        className="motion kicker inline-flex shrink-0 items-center gap-1.5 rounded-[999px] bg-accent px-3.5 py-2 text-[11px] text-accent-on disabled:opacity-45"
      >
        <Upload size={16} strokeWidth={2} />
        Verkopen importeren
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden desktop:flex h-[66px] shrink-0 items-center justify-between border-b border-border-light bg-white px-6">
        <div className="flex flex-col">
          <h1 className="display text-[22px] leading-none text-ink">{title}</h1>
          {data && (
            <p className="kicker text-[11px] text-text-muted">
              Data bijgewerkt: {formatDateTime(data.gegenereerd_op)}
            </p>
          )}
        </div>
        {importKnop}
      </div>

      <div className="flex desktop:hidden items-center justify-between gap-2 border-b border-border-light bg-white px-[18px] py-2.5">
        {data && (
          <p className="kicker text-[10px] text-text-muted">
            Bijgewerkt: {formatDateTime(data.gegenereerd_op)}
          </p>
        )}
        {importKnop}
      </div>

      {melding && (
        <p
          role="status"
          className={`mx-[18px] desktop:mx-6 rounded-[8px] px-3 py-2 text-[12px] ${
            melding.type === "success" ? "bg-green-tint text-green-text" : "bg-amber-tint text-amber-text"
          }`}
        >
          {melding.tekst}
        </p>
      )}
    </div>
  );
}
