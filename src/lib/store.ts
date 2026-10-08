import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Arrangement,
  Boeking,
  Optie,
  SligroData,
} from "../types/sligro";

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
  updateArrangement: (id: string, patch: Partial<Omit<Arrangement, "id">>) => void;
  verwijderArrangement: (id: string) => void;

  maakOptie: (naam: string) => string;
  updateOptie: (id: string, patch: Partial<Omit<Optie, "id">>) => void;
  verwijderOptie: (id: string) => void;

  voegBoekingToe: (boeking: Omit<Boeking, "id">) => void;
  updateBoeking: (id: string, patch: Partial<Omit<Boeking, "id">>) => void;
  verwijderBoeking: (id: string) => void;
}

export const useSligroStore = create<SligroStore>()(
  persist(
    immer((set, get) => ({
      data: null,

      laden: async () => {
        if (get().data) return;
        const res = await fetch(SEED_URL);
        if (!res.ok) throw new Error(`Kon data niet laden: HTTP ${res.status}`);
        const seed = (await res.json()) as SligroData;
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
          state.data?.arrangementen.push({ id, naam, items: [] });
        });
        return id;
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
          state.data.boekingen = state.data.boekingen.filter((b) => b.arrangement_id !== id);
        });
      },

      maakOptie: (naam) => {
        const id = nieuwId();
        set((state) => {
          state.data?.opties.push({ id, naam, items: [] });
        });
        return id;
      },
      updateOptie: (id, patch) => {
        set((state) => {
          const o = state.data?.opties.find((x) => x.id === id);
          if (o) Object.assign(o, patch);
        });
      },
      verwijderOptie: (id) => {
        set((state) => {
          if (!state.data) return;
          state.data.opties = state.data.opties.filter((x) => x.id !== id);
          for (const b of state.data.boekingen) {
            delete b.opties[id];
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
    })),
    { name: "sligro-store" },
  ),
);
