import { describe, expect, it } from "vitest";
import {
  bepaalBoekingStatus,
  berekenBenodigdUitArrangementen,
  berekenBoekingConsumptie,
  samenvatBoekingConsumptie,
} from "../src/lib/arrangementen";
import type { Arrangement, Boeking, Optie } from "../src/types/sligro";

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
    items: [
      { sligronummer: "VLEES", per_persoon: 0.3 },
      { sligronummer: "BROOD", per_persoon: 1 },
    ],
  };

  const halal: Optie = {
    id: "halal",
    naam: "Halal",
    items: [{ sligronummer: "HALAL-VLEES", per_persoon: 0.3, vervangt: "VLEES" }],
  };

  const extraSaus: Optie = {
    id: "saus",
    naam: "Extra saus",
    items: [{ sligronummer: "SAUS", per_persoon: 0.1, vervangt: null }],
  };

  it("rekent standaarditems over alle personen zonder opties", () => {
    const boeking: Boeking = { id: "1", arrangement_id: "bbq", datum: "2026-05-01", aantal_personen: 40, opties: {} };
    const consumptie = berekenBoekingConsumptie(boeking, bbq, [halal, extraSaus]);
    expect(consumptie).toEqual({ VLEES: 12, BROOD: 40 });
  });

  it("vervangt-optie neemt het aandeel van het standaarditem over i.p.v. erbij te komen", () => {
    // 40 personen, waarvan 4 halal -> 36 * 0.3 regulier vlees + 4 * 0.3 halal-vlees
    const boeking: Boeking = {
      id: "1",
      arrangement_id: "bbq",
      datum: "2026-05-01",
      aantal_personen: 40,
      opties: { halal: 4 },
    };
    const consumptie = berekenBoekingConsumptie(boeking, bbq, [halal, extraSaus]);
    expect(consumptie.VLEES).toBeCloseTo(36 * 0.3, 6);
    expect(consumptie["HALAL-VLEES"]).toBeCloseTo(4 * 0.3, 6);
    expect(consumptie.BROOD).toBe(40);
  });

  it("een optie zonder vervangt komt erbij, niet in plaats van", () => {
    const boeking: Boeking = {
      id: "1",
      arrangement_id: "bbq",
      datum: "2026-05-01",
      aantal_personen: 40,
      opties: { saus: 10 },
    };
    const consumptie = berekenBoekingConsumptie(boeking, bbq, [halal, extraSaus]);
    expect(consumptie.VLEES).toBe(12);
    expect(consumptie.SAUS).toBeCloseTo(1, 6);
  });

  it("combineert meerdere opties correct (subset, niet erbovenop)", () => {
    // 40 totaal, waarvan 4 halal + 2 glutenvrij(brood) -> som moet optellen tot 40, niet 46
    const glutenvrij: Optie = {
      id: "gv",
      naam: "Glutenvrij",
      items: [{ sligronummer: "GV-BROOD", per_persoon: 1, vervangt: "BROOD" }],
    };
    const boeking: Boeking = {
      id: "1",
      arrangement_id: "bbq",
      datum: "2026-05-01",
      aantal_personen: 40,
      opties: { halal: 4, gv: 2 },
    };
    const consumptie = berekenBoekingConsumptie(boeking, bbq, [halal, extraSaus, glutenvrij]);
    expect(consumptie.VLEES).toBeCloseTo(36 * 0.3, 6);
    expect(consumptie["HALAL-VLEES"]).toBeCloseTo(4 * 0.3, 6);
    expect(consumptie.BROOD).toBe(38);
    expect(consumptie["GV-BROOD"]).toBe(2);
    const { totaalStuks } = samenvatBoekingConsumptie(consumptie);
    // (36*.3 + 4*.3) vlees-equivalent + 38 + 2 brood = 12 + 40
    expect(totaalStuks).toBeCloseTo(12 + 40, 6);
  });

  it("geeft lege consumptie als het arrangement niet (meer) bestaat", () => {
    const boeking: Boeking = { id: "1", arrangement_id: "weg", datum: "2026-05-01", aantal_personen: 10, opties: {} };
    expect(berekenBoekingConsumptie(boeking, undefined, [])).toEqual({});
  });
});

describe("berekenBenodigdUitArrangementen", () => {
  const bbq: Arrangement = {
    id: "bbq",
    naam: "BBQ",
    items: [{ sligronummer: "VLEES", per_persoon: 1 }],
  };

  it("telt alleen boekingen mee die binnen de horizon vallen", () => {
    const boekingen: Boeking[] = [
      { id: "verleden", arrangement_id: "bbq", datum: "2026-01-01", aantal_personen: 10, opties: {} },
      { id: "binnenkort", arrangement_id: "bbq", datum: "2026-02-05", aantal_personen: 20, opties: {} },
      { id: "later", arrangement_id: "bbq", datum: "2026-06-01", aantal_personen: 30, opties: {} },
    ];
    const resultaat = berekenBenodigdUitArrangementen(boekingen, [bbq], [], "2026-02-01", 2);
    expect(resultaat).toEqual({ VLEES: 20 });
  });

  it("telt meerdere kwalificerende boekingen bij elkaar op", () => {
    const boekingen: Boeking[] = [
      { id: "a", arrangement_id: "bbq", datum: "2026-02-02", aantal_personen: 10, opties: {} },
      { id: "b", arrangement_id: "bbq", datum: "2026-02-10", aantal_personen: 5, opties: {} },
    ];
    const resultaat = berekenBenodigdUitArrangementen(boekingen, [bbq], [], "2026-02-01", 2);
    expect(resultaat.VLEES).toBe(15);
  });
});
