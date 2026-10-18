import { useRef, useState } from "react";
import readXlsxFile from "read-excel-file";
import { Upload, X } from "lucide-react";
import { useSligroStore } from "../lib/store";
import {
  matchRecrasRegels,
  parseRecrasRijen,
  vindOngematchteProducten,
  type RecrasMatchRegel,
} from "../lib/recras-import";
import type { Arrangement, ArrangementStatus } from "../types/sligro";

// Zolang er geen live koppeling met RECRAS is, levert Tim periodiek een
// export van het rapport "Geboekte producten" aan (xlsx). Die bevat per
// boeking meerdere losse productregels (elk een eigen tijdslot/aantal) —
// geen hoofd/sub-structuur, zie src/lib/recras-import.ts. Deze knop leest
// dat bestand in de browser in (read-excel-file i.p.v. het populairdere
// "xlsx"-pakket, dat onopgeloste prototype-pollution/ReDoS-kwetsbaarheden
// heeft — zie package.json), matcht de productnamen aan bestaande
// productsjablonen, en laat Tim in een review-stap per onbekend product
// kiezen wat ermee moet gebeuren (zie Keuze hieronder) — niet alles wordt
// klakkeloos als nieuw sjabloon aangemaakt, want niet elk RECRAS-"product"
// is iets om Sligro-spullen voor te bestellen (bv. zaalhuur, een
// reservering, een regel als "eigen taart meenemen").

const VEREISTE_KOLOMMEN = ["Boeking", "Product", "Begindatum", "Aantal", "Status"];

type Stap = "upload" | "beoordelen" | "klaar";

// overslaan = niets aanmaken, regel blijft "nog niet gekoppeld" in de
// boekingenlijst; sjabloon = nieuw productsjabloon (status "controleer",
// Sligro-verbruik vul je later in); nvt = nieuw sjabloon met status "nvt"
// (telt nooit mee, maar voorkomt dat een volgende import er opnieuw om vraagt).
type Keuze = "overslaan" | "sjabloon" | "nvt";

const KEUZE_LABEL: Record<Keuze, string> = {
  overslaan: "Overslaan (nog niet beslissen)",
  sjabloon: "Nieuw sjabloon — moet nog ingevuld",
  nvt: "N.v.t. — hoort niet bij bestellen",
};

export function RecrasImportKnop({ arrangementen }: { arrangementen: Arrangement[] }) {
  const maakArrangementenBulk = useSligroStore((s) => s.maakArrangementenBulk);
  const importeerRecrasBoekingen = useSligroStore((s) => s.importeerRecrasBoekingen);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [stap, setStap] = useState<Stap>("upload");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [regels, setRegels] = useState<RecrasMatchRegel[]>([]);
  const [keuzes, setKeuzes] = useState<Record<string, Keuze>>({});
  const [resultaatTekst, setResultaatTekst] = useState<string | null>(null);

  function sluiten() {
    setOpen(false);
    setStap("upload");
    setBezig(false);
    setFout(null);
    setRegels([]);
    setKeuzes({});
    setResultaatTekst(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setBezig(true);
    setFout(null);
    try {
      const rows = await readXlsxFile(file);
      if (rows.length < 2) {
        setFout("Geen productregels gevonden in dit bestand.");
        return;
      }
      const [header, ...dataRows] = rows;
      const kolomIndex = new Map(header.map((h, i) => [String(h ?? "").trim(), i]));
      const ontbreekt = VEREISTE_KOLOMMEN.filter((k) => !kolomIndex.has(k));
      if (ontbreekt.length > 0) {
        setFout(`Dit lijkt geen RECRAS "Geboekte producten"-export — kolommen ontbreken: ${ontbreekt.join(", ")}.`);
        return;
      }
      const ruweRijen = dataRows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const [naam, i] of kolomIndex) obj[naam] = row[i];
        return obj;
      });
      const parsed = parseRecrasRijen(ruweRijen);
      if (parsed.length === 0) {
        setFout("Geen geldige productregels gevonden (Boeking, Product en Begindatum moeten ingevuld zijn).");
        return;
      }
      const gematcht = matchRecrasRegels(parsed, arrangementen);
      setRegels(gematcht);
      const nieuweKeuzes: Record<string, Keuze> = {};
      for (const naam of vindOngematchteProducten(gematcht)) nieuweKeuzes[naam] = "overslaan";
      setKeuzes(nieuweKeuzes);
      setStap("beoordelen");
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Onbekende fout bij het lezen van het bestand.");
    } finally {
      setBezig(false);
    }
  }

  function zetKeuzeVoorAllen(keuze: Keuze) {
    setKeuzes((huidig) => {
      const volgende: Record<string, Keuze> = {};
      for (const naam of Object.keys(huidig)) volgende[naam] = keuze;
      return volgende;
    });
  }

  function bevestigen() {
    const nieuweSjablonen = Object.entries(keuzes)
      .filter(([, keuze]) => keuze !== "overslaan")
      .map(([naam, keuze]) => ({ naam, status: (keuze === "nvt" ? "nvt" : "controleer") as ArrangementStatus }));
    maakArrangementenBulk(nieuweSjablonen);
    // De zojuist aangemaakte sjablonen moeten ook meteen als match gelden —
    // simpelst door de volledige, bijgewerkte arrangementenlijst uit de
    // store te halen en opnieuw (dezelfde matchlogica) te matchen, i.p.v.
    // hier losse naam-normalisatie te dupliceren.
    const bijgewerkt = useSligroStore.getState().data?.arrangementen ?? [];
    const definitief = matchRecrasRegels(regels, bijgewerkt);
    importeerRecrasBoekingen(definitief);

    const aantalBoekingen = new Set(definitief.map((r) => r.recras_boeking)).size;
    const perStatus = { definitief: 0, optie: 0, voltooid: 0 };
    for (const r of definitief) perStatus[r.status]++;
    const aantalSjabloon = nieuweSjablonen.filter((n) => n.status === "controleer").length;
    const aantalNvt = nieuweSjablonen.filter((n) => n.status === "nvt").length;
    const aantalOvergeslagen = Object.values(keuzes).filter((k) => k === "overslaan").length;
    const extra: string[] = [];
    if (aantalSjabloon > 0) extra.push(`${aantalSjabloon} nieuwe sjablonen aangemaakt (status "controleer")`);
    if (aantalNvt > 0) extra.push(`${aantalNvt} gemarkeerd als n.v.t.`);
    if (aantalOvergeslagen > 0) extra.push(`${aantalOvergeslagen} producten overgeslagen (nog niet gekoppeld)`);
    setResultaatTekst(
      `${definitief.length} productregels geïmporteerd uit ${aantalBoekingen} boekingen ` +
        `(${perStatus.definitief} definitief, ${perStatus.optie} optie, ${perStatus.voltooid} voltooid).` +
        (extra.length > 0 ? ` ${extra.join(", ")}.` : ""),
    );
    setStap("klaar");
  }

  const perStatusPreview = regels.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { definitief: 0, optie: 0, voltooid: 0 },
  );
  const aantalBoekingenPreview = new Set(regels.map((r) => r.recras_boeking)).size;
  const ongematchteNamen = vindOngematchteProducten(regels);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="motion kicker inline-flex items-center gap-1.5 rounded-[999px] bg-accent px-3.5 py-2 text-[11px] text-accent-on"
      >
        <Upload size={16} strokeWidth={2} />
        Boekingen importeren (RECRAS)
      </button>

      {open && (
        <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/40 p-4">
          <div className="flex w-full max-w-[720px] flex-col gap-4 rounded-[18px] bg-white p-5 shadow-[var(--shadow-hover)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="display text-[20px] text-ink">Boekingen importeren uit RECRAS</h2>
                <p className="text-[13px] text-text-muted">
                  Upload het "Geboekte producten"-overzicht (.xlsx) zoals je dat uit RECRAS exporteert.
                </p>
              </div>
              <button
                type="button"
                onClick={sluiten}
                className="motion flex h-8 w-8 shrink-0 items-center justify-center rounded-[999px] text-text-muted hover:bg-zand"
                aria-label="Sluiten"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {stap === "upload" && (
              <div className="flex flex-col gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  disabled={bezig}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                  className="rounded-[8px] border border-dashed border-border-light bg-zand/30 px-3 py-6 text-[13px] text-text-medium"
                />
                {bezig && <p className="text-[13px] text-text-muted">Bestand wordt gelezen…</p>}
                {fout && <p className="rounded-[8px] bg-amber-tint px-3 py-2 text-[12px] text-amber-text">{fout}</p>}
              </div>
            )}

            {stap === "beoordelen" && (
              <div className="flex flex-col gap-4">
                <p className="text-[13px] text-ink">
                  {regels.length} productregels gevonden uit {aantalBoekingenPreview} boekingen —{" "}
                  {perStatusPreview.definitief} definitief, {perStatusPreview.optie} optie,{" "}
                  {perStatusPreview.voltooid} voltooid. Alleen "definitief" telt mee in het inkoopadvies; de rest komt
                  wel in de boekingenlijst te staan, ter info.
                </p>

                {ongematchteNamen.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-[10px] border border-border-light bg-zand/30 p-3">
                    <p className="kicker text-[11px] text-text-muted">
                      {ongematchteNamen.length} productnamen hebben nog geen sjabloon. Kies per product: wordt dit
                      iets om Sligro-spullen voor te bestellen (nieuw sjabloon), of hoort het daar niet bij (bv.
                      zaalhuur, een reservering — n.v.t.)? Laat op "overslaan" staan om nu niets te doen; de regel
                      blijft dan als "nog niet gekoppeld" in de boekingenlijst staan.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => zetKeuzeVoorAllen("overslaan")}
                        className="motion kicker rounded-[999px] border border-border-light bg-white px-2.5 py-1 text-[10px] text-text-medium hover:border-accent"
                      >
                        Alles op overslaan
                      </button>
                      <button
                        type="button"
                        onClick={() => zetKeuzeVoorAllen("sjabloon")}
                        className="motion kicker rounded-[999px] border border-border-light bg-white px-2.5 py-1 text-[10px] text-text-medium hover:border-accent"
                      >
                        Alles op nieuw sjabloon
                      </button>
                      <button
                        type="button"
                        onClick={() => zetKeuzeVoorAllen("nvt")}
                        className="motion kicker rounded-[999px] border border-border-light bg-white px-2.5 py-1 text-[10px] text-text-medium hover:border-accent"
                      >
                        Alles op n.v.t.
                      </button>
                    </div>
                    <div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto">
                      {ongematchteNamen.map((naam) => (
                        <div key={naam} className="flex flex-wrap items-center justify-between gap-2 py-0.5">
                          <span className="text-[13px] text-ink">{naam}</span>
                          <select
                            value={keuzes[naam] ?? "overslaan"}
                            onChange={(e) => setKeuzes((h) => ({ ...h, [naam]: e.target.value as Keuze }))}
                            className="rounded-[8px] border border-border-light bg-white px-2 py-1 text-[12px] text-ink"
                          >
                            {(Object.keys(KEUZE_LABEL) as Keuze[]).map((k) => (
                              <option key={k} value={k}>
                                {KEUZE_LABEL[k]}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-[8px] bg-green-tint px-3 py-2 text-[12px] text-green-text">
                    Alle producten zijn al aan een sjabloon gekoppeld.
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={sluiten}
                    className="motion kicker rounded-[999px] border border-border-light bg-white px-4 py-2 text-[11px] text-text-medium"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={bevestigen}
                    className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on"
                  >
                    Importeren
                  </button>
                </div>
              </div>
            )}

            {stap === "klaar" && (
              <div className="flex flex-col gap-4">
                <p className="rounded-[8px] bg-green-tint px-3 py-2 text-[13px] text-green-text">{resultaatTekst}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={sluiten}
                    className="motion kicker rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on"
                  >
                    Sluiten
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
