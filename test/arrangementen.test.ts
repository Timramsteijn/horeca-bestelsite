import { describe, expect, it } from "vitest";
import {
  bepaalBoekingStatus,
  berekenBenodigdUitArrangementen,
  berekenBoekingConsumptie,
} from "../src/lib/arrangementen";
import type { Arrangement, Boeking } from "../src/types/sligro";

function maakBoeking(overrides: Partial<Boeking>): Boeking {
  return {
    id: "1",
    arrangement_id: "bbq",
    product_naam: "BBQ",
    aantal_personen: 40,
    datum: "2026-05-01",
    bron: "handmatig",
    recras_boeking: null,
    boekingsnaam: null,
    status: "definitief",
    ...overrides,
  };
}

describe("bepaalBoekingStatus", () => {
  it("is 'geweest' voor een datum in het verleden", () => {
    expect(bepaalBoekingStatus("2026-01-01", "2026-02-01", 2)).toBe("geweest");
  });
  it("is 'telt_mee' binnen de weken-vooruit-horizon", () => {
    expect(bepaalBoekingStatus("2026-02-10", "2026-02-01", 2)).toBe("telt_mee");
  });
  it("is 'telt_mee' op precies de horizon-datum", () => {
    expect(bepaalBoekingStatus("2026-02-15", "2026-02-01", 2)).toBe("telt_mee");
  });
  it("is 'later' na de horizon", () => {
    expect(bepaalBoekingStatus("2026-03-01", "2026-02-01", 2)).toBe("later");
  });
  it("telt vandaag zelf mee", () => {
    expect(bepaalBoekingStatus("2026-02-01", "2026-02-01", 2)).toBe("telt_mee");
  });
});

describe("berekenBoekingConsumptie", () => {
  const bbq: Arrangement = {
    id: "bbq",
    naam: "BBQ",
    status: "zeker",
    items: [
      { sligronummer: "VLEES", per_persoon: 0.3 },
      { sligronummer: "BROOD", per_persoon: 1 },
    ],
  };

  it("rekent de sjabloonitems over alle personen", () => {
    const boeking = maakBoeking({ aantal_personen: 40 });
    const consumptie = berekenBoekingConsumptie(boeking, bbq);
    expect(consumptie).toEqual({ VLEES: 12, BROOD: 40 });
  });

  it("geeft lege consumptie als er nog geen (of geen bestaand) sjabloon gekoppeld is", () => {
    const boeking = maakBoeking({ arrangement_id: null, aantal_personen: 10 });
    expect(berekenBoekingConsumptie(boeking, undefined)).toEqual({});
  });
});

describe("berekenBenodigdUitArrangementen", () => {
  const bbq: Arrangement = {
    id: "bbq",
    naam: "BBQ",
    status: "zeker",
    items: [{ sligronummer: "VLEES", per_persoon: 1 }],
  };

  it("telt alleen boekingen mee die binnen de horizon vallen", () => {
    const boekingen: Boeking[] = [
      maakBoeking({ id: "verleden", datum: "2026-01-01", aantal_personen: 10 }),
      maakBoeking({ id: "binnenkort", datum: "2026-02-05", aantal_personen: 20 }),
      maakBoeking({ id: "later", datum: "2026-06-01", aantal_personen: 30 }),
    ];
    const resultaat = berekenBenodigdUitArrangementen(boekingen, [bbq], "2026-02-01", 2);
    expect(resultaat).toEqual({ VLEES: 20 });
  });

  it("telt meerdere kwalificerende boekingen bij elkaar op", () => {
    const boekingen: Boeking[] = [
      maakBoeking({ id: "a", datum: "2026-02-02", aantal_personen: 10 }),
      maakBoeking({ id: "b", datum: "2026-02-10", aantal_personen: 5 }),
    ];
    const resultaat = berekenBenodigdUitArrangementen(boekingen, [bbq], "2026-02-01", 2);
    expect(resultaat.VLEES).toBe(15);
  });

  it("telt 'optie'- en 'voltooid'-boekingen niet mee, alleen 'definitief'", () => {
    const boekingen: Boeking[] = [
      maakBoeking({ id: "optie", datum: "2026-02-05", aantal_personen: 20, status: "optie" }),
      maakBoeking({ id: "voltooid", datum: "2026-02-05", aantal_personen: 20, status: "voltooid" }),
      maakBoeking({ id: "definitief", datum: "2026-02-05", aantal_personen: 7, status: "definitief" }),
    ];
    const resultaat = berekenBenodigdUitArrangementen(boekingen, [bbq], "2026-02-01", 2);
    expect(resultaat).toEqual({ VLEES: 7 });
  });

  it("telt een boeking met een nog niet op 'zeker' gezet sjabloon niet mee", () => {
    const nogControleren: Arrangement = { ...bbq, id: "nieuw", status: "controleer" };
    const boekingen: Boeking[] = [
      maakBoeking({ id: "a", arrangement_id: "nieuw", datum: "2026-02-05", aantal_personen: 20 }),
    ];
    const resultaat = berekenBenodigdUitArrangementen(boekingen, [nogControleren], "2026-02-01", 2);
    expect(resultaat).toEqual({});
  });

  it("telt een boeking met een 'nvt'-sjabloon nooit mee (hoort niet bij bestellen)", () => {
    const nietVanToepassing: Arrangement = { ...bbq, id: "zaalhuur", status: "nvt" };
    const boekingen: Boeking[] = [
      maakBoeking({ id: "a", arrangement_id: "zaalhuur", datum: "2026-02-05", aantal_personen: 20 }),
    ];
    const resultaat = berekenBenodigdUitArrangementen(boekingen, [nietVanToepassing], "2026-02-01", 2);
    expect(resultaat).toEqual({});
  });
});
