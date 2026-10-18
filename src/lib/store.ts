import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { DEFAULT_BUFFER_PCT, DEFAULT_WEKEN_VOORUIT } from "./inkoopadvies";
import type {
  Arrangement,
  ArrangementStatus,
  ArtikelStatus,
  Boeking,
  KoppeltabelRow,
  SligroData,
} from "../types/sligro";
import type { RecrasMatchRegel } from "./recras-import";

// De volledige dataset wordt client-side gehouden en bij elke wijziging naar
// localStorage geschreven (zie PROMPT: "lokale opslag volstaat voor een
// prototype"). Dit is dus éénmalig geseed vanuit het meegeleverde
// sligro-data.json — latere deploys met bijgewerkte brondata komen niet
// automatisch door bij iemand die al lokale wijzigingen heeft. Een echte
// database/sync is nodig zodra dit voor meerdere gebruikers/apparaten moet
// werken (expliciet open punt, zie README).
const SEED_URL = "/data/sligro-data.json";

function nieuwId(): string {
  return crypto.randomUUID();
}

// Backfill voor lokaal opgeslagen data van vóór een schema-uitbreiding: wie
// de site al gebruikte voordat bv. "seizoenen" bestond, heeft dat veld niet
// in zijn localStorage-snapshot staan. Zonder dit loopt elke actie die zo'n
// veld aanspreekt stil vast (bv. "Seizoen aanmaken" doet dan niets zichtbaars).
function vulOntbrekendeVeldenAan(data: SligroData): void {
  data.arrangementen ??= [];
  data.boekingen ??= [];
  data.seizoenen ??= [];
  data.instellingen ??= { weken_vooruit: DEFAULT_WEKEN_VOORUIT, buffer_pct: DEFAULT_BUFFER_PCT };
  data.actief_seizoen_id ??= null;
}

interface SligroStore {
  data: SligroData | null;
  laden: () => Promise<void>;

  werkTellingBij: (artikelnummer: string, nieuweVoorraad: number, datum: string, bron: string) => void;
  werkTellingenBulkBij: (
    entries: { artikelnummer: string; aantal: number }[],
    datum: string,
    bron: string,
  ) => void;
  // Geeft false (en doet niets) als het artikelnummer al bestaat — voorkomt
  // dat een bestaand artikel per ongeluk wordt overschreven, want voorraad
  // is een Record met artikelnummer als key.
  voegArtikelToe: (
    artikelnummer: string,
    omschrijving: string,
    verpakkingsgrootte: number,
    datum: string,
  ) => boolean;
  updateArtikelGegevens: (
    artikelnummer: string,
    patch: Partial<{
      omschrijving: string;
      verpakkingsgrootte: number;
      status: ArtikelStatus;
      arrangement_alleen: boolean;
    }>,
  ) => void;

  verwerkVerkoopImport: (
    periodeLabel: string,
    weken: number,
    perArtikelStuks: Record<string, number>,
    datum: string,
  ) => void;

  // Geeft false (en doet niets) als dit pid al bestaat.
  voegKoppeltabelRijToe: (row: KoppeltabelRow) => boolean;
  updateKoppeltabelRij: (pid: string, patch: Partial<Omit<KoppeltabelRow, "pid">>) => void;
  verwijderKoppeltabelRij: (pid: string) => void;

  maakArrangement: (naam: string) => string;
  maakArrangementenBulk: (entries: { naam: string; status: ArrangementStatus }[]) => Record<string, string>;
  updateArrangement: (id: string, patch: Partial<Omit<Arrangement, "id">>) => void;
  verwijderArrangement: (id: string) => void;

  voegBoekingToe: (boeking: Omit<Boeking, "id">) => void;
  updateBoeking: (id: string, patch: Partial<Omit<Boeking, "id">>) => void;
  verwijderBoeking: (id: string) => void;
  wisBoekingen: () => void;
  importeerRecrasBoekingen: (regels: RecrasMatchRegel[]) => void;

  maakSeizoen: (naam: string, doelvoorraad: Record<string, number>) => string;
  updateSeizoen: (id: string, patch: { naam?: string }) => void;
  verwijderSeizoen: (id: string) => void;
  setDoelvoorraad: (seizoenId: string, artikelnummer: string, verpakkingen: number) => void;
  activeerSeizoen: (id: string | null) => void;
}

export const useSligroStore = create<SligroStore>()(
  persist(
    immer((set, get) => ({
      data: null,

      laden: async () => {
        if (get().data) {
          // Al geladen (vers geseed of gerehydrateerd uit localStorage) —
          // vul alsnog ontbrekende velden aan voor wie de site al gebruikte
          // vóórdat die velden bestonden.
          set((state) => {
            if (state.data) vulOntbrekendeVeldenAan(state.data);
          });
          return;
        }
        const res = await fetch(SEED_URL);
        if (!res.ok) throw new Error(`Kon data niet laden: HTTP ${res.status}`);
        const seed = (await res.json()) as SligroData;
        vulOntbrekendeVeldenAan(seed);
        set((state) => {
          state.data = seed;
        });
      },

      werkTellingBij: (artikelnummer, nieuweVoorraad, datum, bron) => {
        set((state) => {
          const item = state.data?.voorraad[artikelnummer];
          if (!item) return;
          const delta = nieuweVoorraad - item.aantal_stuks;
          item.mutaties.unshift({ datum, soort: "telling", delta, bron });
          item.aantal_stuks = nieuweVoorraad;
          item.laatst_bijgewerkt = datum;
          item.laatste_telling = datum;
        });
      },

      werkTellingenBulkBij: (entries, datum, bron) => {
        set((state) => {
          if (!state.data) return;
          for (const { artikelnummer, aantal } of entries) {
            const item = state.data.voorraad[artikelnummer];
            if (!item) continue;
            const delta = aantal - item.aantal_stuks;
            item.mutaties.unshift({ datum, soort: "telling", delta, bron });
            item.aantal_stuks = aantal;
            item.laatst_bijgewerkt = datum;
            item.laatste_telling = datum;
          }
        });
      },

      voegArtikelToe: (artikelnummer, omschrijving, verpakkingsgrootte, datum) => {
        if (get().data?.voorraad[artikelnummer]) return false;
        set((state) => {
          if (!state.data) return;
          state.data.voorraad[artikelnummer] = {
            omschrijving,
            aantal_stuks: 0,
            verpakkingsgrootte,
            laatst_bijgewerkt: datum,
            laatste_telling: datum,
            status: "zeker",
            // Een artikel dat je zelf aanmaakt voor een productsjabloon is
            // per definitie niet los verkocht via Lightspeed — anders had
            // het al in de voorraadlijst gestaan.
            arrangement_alleen: true,
            mutaties: [],
          };
        });
        return true;
      },
      updateArtikelGegevens: (artikelnummer, patch) => {
        set((state) => {
          const item = state.data?.voorraad[artikelnummer];
          if (item) Object.assign(item, patch);
        });
      },

      verwerkVerkoopImport: (periodeLabel, weken, perArtikelStuks, datum) => {
        set((state) => {
          if (!state.data) return;
          const vp = state.data.verkoop_periodes;
          if (!vp.periodes.some((p) => p.label === periodeLabel)) {
            vp.periodes.push({ label: periodeLabel, weken });
          }
          for (const [artikelnummer, verkocht] of Object.entries(perArtikelStuks)) {
            if (verkocht === 0) continue;
            const item = state.data.voorraad[artikelnummer];
            if (!item) continue;

            const bestaand = vp.per_artikel[artikelnummer];
            if (bestaand) {
              bestaand.verkoop_per_periode[periodeLabel] = verkocht;
            } else {
              vp.per_artikel[artikelnummer] = {
                omschrijving: item.omschrijving,
                verkoop_per_periode: { [periodeLabel]: verkocht },
              };
            }

            item.mutaties.unshift({
              datum,
              soort: "verkoop",
              delta: -verkocht,
              bron: periodeLabel,
            });
            item.aantal_stuks = Math.max(0, item.aantal_stuks - verkocht);
            item.laatst_bijgewerkt = datum;
          }
        });
      },

      voegKoppeltabelRijToe: (row) => {
        if (get().data?.koppeltabel.some((r) => r.pid === row.pid)) return false;
        set((state) => {
          state.data?.koppeltabel.push(row);
        });
        return true;
      },
      updateKoppeltabelRij: (pid, patch) => {
        set((state) => {
          const rij = state.data?.koppeltabel.find((r) => r.pid === pid);
          if (rij) Object.assign(rij, patch);
        });
      },
      verwijderKoppeltabelRij: (pid) => {
        set((state) => {
          if (!state.data) return;
          state.data.koppeltabel = state.data.koppeltabel.filter((r) => r.pid !== pid);
        });
      },

      maakArrangement: (naam) => {
        const id = nieuwId();
        set((state) => {
          state.data?.arrangementen.push({ id, naam, items: [], status: "controleer" });
        });
        return id;
      },
      maakArrangementenBulk: (entries) => {
        const idPerNaam: Record<string, string> = {};
        set((state) => {
          if (!state.data) return;
          for (const { naam, status } of entries) {
            const id = nieuwId();
            idPerNaam[naam] = id;
            state.data.arrangementen.push({ id, naam, items: [], status });
          }
        });
        return idPerNaam;
      },
      updateArrangement: (id, patch) => {
        set((state) => {
          const a = state.data?.arrangementen.find((x) => x.id === id);
          if (a) Object.assign(a, patch);
        });
      },
      verwijderArrangement: (id) => {
        set((state) => {
          if (!state.data) return;
          state.data.arrangementen = state.data.arrangementen.filter((x) => x.id !== id);
          for (const b of state.data.boekingen) {
            if (b.arrangement_id === id) b.arrangement_id = null;
          }
        });
      },

      voegBoekingToe: (boeking) => {
        set((state) => {
          state.data?.boekingen.push({ ...boeking, id: nieuwId() });
        });
      },
      updateBoeking: (id, patch) => {
        set((state) => {
          const b = state.data?.boekingen.find((x) => x.id === id);
          if (b) Object.assign(b, patch);
        });
      },
      verwijderBoeking: (id) => {
        set((state) => {
          if (!state.data) return;
          state.data.boekingen = state.data.boekingen.filter((x) => x.id !== id);
        });
      },
      wisBoekingen: () => {
        set((state) => {
          if (!state.data) return;
          state.data.boekingen = [];
        });
      },
      importeerRecrasBoekingen: (regels) => {
        set((state) => {
          if (!state.data) return;
          // Een RECRAS-import is een verse, volledige momentopname van de
          // aankomende boekingen — vervangt dus alle eerder via RECRAS
          // geïmporteerde regels, maar laat handmatig ingevoerde boekingen
          // ongemoeid.
          state.data.boekingen = state.data.boekingen.filter((b) => b.bron !== "recras");
          for (const regel of regels) {
            state.data.boekingen.push({
              id: nieuwId(),
              arrangement_id: regel.arrangement_id,
              product_naam: regel.product_naam,
              aantal_personen: regel.aantal,
              datum: regel.datum,
              bron: "recras",
              recras_boeking: regel.recras_boeking,
              boekingsnaam: regel.boekingsnaam,
              status: regel.status,
            });
          }
        });
      },

      maakSeizoen: (naam, doelvoorraad) => {
        const id = nieuwId();
        set((state) => {
          state.data?.seizoenen.push({ id, naam, doelvoorraad: { ...doelvoorraad } });
        });
        return id;
      },
      updateSeizoen: (id, patch) => {
        set((state) => {
          const seizoen = state.data?.seizoenen.find((x) => x.id === id);
          if (seizoen) Object.assign(seizoen, patch);
        });
      },
      verwijderSeizoen: (id) => {
        set((state) => {
          if (!state.data) return;
          state.data.seizoenen = state.data.seizoenen.filter((x) => x.id !== id);
          if (state.data.actief_seizoen_id === id) state.data.actief_seizoen_id = null;
        });
      },
      setDoelvoorraad: (seizoenId, artikelnummer, verpakkingen) => {
        set((state) => {
          const seizoen = state.data?.seizoenen.find((x) => x.id === seizoenId);
          if (seizoen) seizoen.doelvoorraad[artikelnummer] = verpakkingen;
        });
      },
      activeerSeizoen: (id) => {
        set((state) => {
          if (!state.data) return;
          state.data.actief_seizoen_id = id;
        });
      },
    })),
    { name: "sligro-store" },
  ),
);
