import { describe, expect, it } from "vitest";
import { berekenInkoopadvies, roundUp } from "../src/lib/inkoopadvies";
import type { KoppeltabelRow, VerkoopPerArtikel, VerkoopPeriode } from "../src/types/sligro";
import sligroData from "../public/data/sligro-data.json";
import type { SligroData } from "../src/types/sligro";

const data = sligroData as unknown as SligroData;

describe("roundUp", () => {
  it("rondt naar boven af, net als Excel ROUNDUP(getal, 0)", () => {
    expect(roundUp(3.1)).toBe(4);
    expect(roundUp(3.0)).toBe(3);
    expect(roundUp(0)).toBe(0);
  });

  it("corrigeert drijvendekomma-afrondfouten rond een geheel getal", () => {
    expect(roundUp(2.9999999999996)).toBe(3);
    expect(roundUp(72.28571428571429)).toBe(73);
  });

  it("geeft 0 voor negatieve of nul input", () => {
    expect(roundUp(-5)).toBe(0);
    expect(roundUp(0)).toBe(0);
  });
});

describe("berekenInkoopadvies — cross-check tegen echte Sligro-data (Cola, 192603)", () => {
  it("berekent par-niveau, vaste voorraad, tekort en te bestellen exact zoals het Excel-werkblad zou doen", () => {
    // Handmatig nagerekend (zie PROMPT.md §5.1) voor artikel 192603 over twee
    // periodes: 2026-04-01 - 2026-07-01 (13 weken, 436 stuks verkocht) en
    // 2026-09-07 - 2026-09-14 (1 week, 4 stuks verkocht).
    // gem/week = 440 / 14 = 31.428571...
    // par = ROUNDUP(31.428571 * 2 * 1.15) = ROUNDUP(72.285714) = 73
    // verpakkingen nodig = ROUNDUP(73 / 24) = 4
    // vaste voorraad = (4 + 1 buffer) * 24 = 120 stuks
    // huidige voorraad = 89 → tekort = 31 → te bestellen = ROUNDUP(31/24) = 2
    const periodeLabels = ["2026-04-01 - 2026-07-01", "2026-09-07 - 2026-09-14"];
    const koppeltabel = data.koppeltabel.filter((row) => row.artikelnummer === "192603");
    const voorraadStuks = { "192603": data.voorraad["192603"].aantal_stuks };

    const resultaat = berekenInkoopadvies(
      koppeltabel,
      voorraadStuks,
      data.verkoop_periodes.per_artikel,
      data.verkoop_periodes.periodes,
      data.buffer_overrides,
      { periodeLabels },
    );

    expect(resultaat).toHaveLength(1);
    const regel = resultaat[0];
    expect(regel.gem_verkoop_per_week).toBeCloseTo(440 / 14, 6);
    expect(regel.par_niveau).toBe(73);
    expect(regel.verpakkingen_nodig).toBe(4);
    expect(regel.buffer_verpakkingen).toBe(1);
    expect(regel.vaste_voorraad_verpakkingen).toBe(5);
    expect(regel.vaste_voorraad_stuks).toBe(120);
    expect(regel.huidige_voorraad).toBe(89);
    expect(regel.tekort).toBe(31);
    expect(regel.te_bestellen_verpakkingen).toBe(2);
  });
});

describe("berekenInkoopadvies — regels", () => {
  const periodes: VerkoopPeriode[] = [
    { label: "week-1", weken: 1 },
    { label: "week-2", weken: 1 },
  ];

  const verkoopPerArtikel: Record<string, VerkoopPerArtikel> = {
    "1": {
      omschrijving: "Testartikel zeker",
      verkoop_per_periode: { "week-1": 10, "week-2": 10 },
    },
    "2": {
      omschrijving: "Testartikel controleer",
      verkoop_per_periode: { "week-1": 1000, "week-2": 1000 },
    },
  };

  const koppeltabel: KoppeltabelRow[] = [
    {
      pid: "a",
      productnaam: "Testartikel zeker",
      artikelnummer: "1",
      omschrijving: "Testartikel zeker",
      aantal_per_verpakking: 10,
      status: "zeker",
      notitie: "",
    },
    {
      pid: "b",
      productnaam: "Testartikel controleer",
      artikelnummer: "2",
      omschrijving: "Testartikel controleer",
      aantal_per_verpakking: 10,
      status: "controleer",
      notitie: "",
    },
  ];

  it("neemt alleen artikelen met status 'zeker' mee", () => {
    const resultaat = berekenInkoopadvies(koppeltabel, {}, verkoopPerArtikel, periodes, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat).toHaveLength(1);
    expect(resultaat[0].artikelnummer).toBe("1");
  });

  it("gebruikt de buffer-override in plaats van de standaard 1 bufferverpakking", () => {
    const resultaat = berekenInkoopadvies(koppeltabel, {}, verkoopPerArtikel, periodes, { "1": 0 }, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat[0].buffer_verpakkingen).toBe(0);
  });

  it("herberekent live met aangepaste weken vooruit en buffer%", () => {
    const standaard = berekenInkoopadvies(koppeltabel, {}, verkoopPerArtikel, periodes, {}, {
      periodeLabels: ["week-1", "week-2"],
    })[0];
    const aangepast = berekenInkoopadvies(koppeltabel, {}, verkoopPerArtikel, periodes, {}, {
      periodeLabels: ["week-1", "week-2"],
      wekenVooruit: 4,
      bufferPct: 0.5,
    })[0];
    expect(aangepast.par_niveau).toBeGreaterThan(standaard.par_niveau);
  });

  it("sorteert op grootste tekort eerst", () => {
    const grotereKoppeltabel: KoppeltabelRow[] = [
      ...koppeltabel,
      {
        pid: "c",
        productnaam: "Testartikel klein tekort",
        artikelnummer: "3",
        omschrijving: "Testartikel klein tekort",
        aantal_per_verpakking: 1,
        status: "zeker",
        notitie: "",
      },
    ];
    const verkoop3: Record<string, VerkoopPerArtikel> = {
      ...verkoopPerArtikel,
      "3": {
        omschrijving: "Testartikel klein tekort",
        verkoop_per_periode: { "week-1": 1, "week-2": 1 },
      },
    };
    const resultaat = berekenInkoopadvies(grotereKoppeltabel, {}, verkoop3, periodes, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    const tekorten = resultaat.map((r) => r.tekort);
    expect(tekorten).toEqual([...tekorten].sort((a, b) => b - a));
  });

  it("geeft tekort 0 en geen geadviseerde bestelling als de voorraad al voldoende is", () => {
    const resultaat = berekenInkoopadvies(koppeltabel, { "1": 10000 }, verkoopPerArtikel, periodes, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat[0].tekort).toBe(0);
    expect(resultaat[0].te_bestellen_verpakkingen).toBe(0);
  });

  it("crasht niet en geeft 0 verkoop terug als een periode ontbreekt voor een artikel", () => {
    const resultaat = berekenInkoopadvies(koppeltabel, {}, {}, periodes, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat[0].gem_verkoop_per_week).toBe(0);
  });
});
