import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { DEFAULT_BUFFER_PCT, DEFAULT_WEKEN_VOORUIT } from "./inkoopadvies";
import type {
  Arrangement,
  Boeking,
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

  verwerkVerkoopImport: (
    periodeLabel: string,
    weken: number,
    perArtikelStuks: Record<string, number>,
    datum: string,
  ) => void;

  maakArrangement: (naam: string) => string;
  maakArrangementenBulk: (namen: string[]) => Record<string, string>;
  updateArrangement: (id: string, patch: Partial<Omit<Arrangement, "id">>) => void;
  verwijderArrangement: (id: string) => void;

  voegBoekingToe: (boeking: Omit<Boeking, "id">) => void;
  updateBoeking: (id: string, patch: Partial<Omit<Boeking, "id">>) => void;
  verwijderBoeking: (id: string) => void;
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

      maakArrangement: (naam) => {
        const id = nieuwId();
        set((state) => {
          state.data?.arrangementen.push({ id, naam, items: [], status: "controleer" });
        });
        return id;
      },
      maakArrangementenBulk: (namen) => {
        const idPerNaam: Record<string, string> = {};
        set((state) => {
          if (!state.data) return;
          for (const naam of namen) {
            const id = nieuwId();
            idPerNaam[naam] = id;
            state.data.arrangementen.push({ id, naam, items: [], status: "controleer" });
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
