import { describe, expect, it } from "vitest";
import { berekenInkoopadvies, roundUp } from "../src/lib/inkoopadvies";
import type { VerkoopPerArtikel, VerkoopPeriode, VoorraadItem } from "../src/types/sligro";
import sligroData from "../public/data/sligro-data.json";
import type { SligroData } from "../src/types/sligro";

const data = sligroData as unknown as SligroData;

function maakArtikel(overrides: Partial<VoorraadItem>): VoorraadItem {
  return {
    artikelnummer: "1",
    omschrijving: "Testartikel",
    aantal_stuks: 0,
    verpakkingsgrootte: 10,
    laatst_bijgewerkt: "2026-01-01",
    laatste_telling: "2026-01-01",
    status: "zeker",
    arrangement_alleen: false,
    mutaties: [],
    ...overrides,
  };
}

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
    // huidige voorraad op proefmoment = 89 → tekort = 31 → te bestellen = ROUNDUP(31/24) = 2
    //
    // De voorraad hieronder is bewust een vaste waarde (niet uit het live
    // bronbestand gelezen): die verandert elke keer dat er een levering
    // wordt bijgeboekt, en deze test controleert de rekenregel, niet de
    // actuele voorraadstand.
    const periodeLabels = ["2026-04-01 - 2026-07-01", "2026-09-07 - 2026-09-14"];
    const voorraadItems = [maakArtikel({ artikelnummer: "192603", verpakkingsgrootte: 24, aantal_stuks: 89 })];

    const resultaat = berekenInkoopadvies(
      voorraadItems,
      data.verkoop_periodes.per_artikel,
      data.verkoop_periodes.periodes,
      data.buffer_overrides,
      {},
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
    expect(regel.streefvoorraad_stuks).toBe(120);
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

  const voorraadItems: VoorraadItem[] = [
    maakArtikel({ artikelnummer: "1", omschrijving: "Testartikel zeker", verpakkingsgrootte: 10, status: "zeker" }),
    maakArtikel({
      artikelnummer: "2",
      omschrijving: "Testartikel controleer",
      verpakkingsgrootte: 10,
      status: "controleer",
    }),
  ];

  it("neemt alleen artikelen met status 'zeker' mee", () => {
    const resultaat = berekenInkoopadvies(voorraadItems, verkoopPerArtikel, periodes, {}, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat).toHaveLength(1);
    expect(resultaat[0].artikelnummer).toBe("1");
  });

  it("gebruikt de buffer-override in plaats van de standaard 1 bufferverpakking", () => {
    const resultaat = berekenInkoopadvies(voorraadItems, verkoopPerArtikel, periodes, { "1": 0 }, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat[0].buffer_verpakkingen).toBe(0);
  });

  it("herberekent live met aangepaste weken vooruit en buffer%", () => {
    const standaard = berekenInkoopadvies(voorraadItems, verkoopPerArtikel, periodes, {}, {}, {
      periodeLabels: ["week-1", "week-2"],
    })[0];
    const aangepast = berekenInkoopadvies(voorraadItems, verkoopPerArtikel, periodes, {}, {}, {
      periodeLabels: ["week-1", "week-2"],
      wekenVooruit: 4,
      bufferPct: 0.5,
    })[0];
    expect(aangepast.par_niveau).toBeGreaterThan(standaard.par_niveau);
  });

  it("sorteert op grootste tekort eerst", () => {
    const meerArtikelen: VoorraadItem[] = [
      ...voorraadItems,
      maakArtikel({
        artikelnummer: "3",
        omschrijving: "Testartikel klein tekort",
        verpakkingsgrootte: 1,
        status: "zeker",
      }),
    ];
    const verkoop3: Record<string, VerkoopPerArtikel> = {
      ...verkoopPerArtikel,
      "3": {
        omschrijving: "Testartikel klein tekort",
        verkoop_per_periode: { "week-1": 1, "week-2": 1 },
      },
    };
    const resultaat = berekenInkoopadvies(meerArtikelen, verkoop3, periodes, {}, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    const tekorten = resultaat.map((r) => r.tekort);
    expect(tekorten).toEqual([...tekorten].sort((a, b) => b - a));
  });

  it("geeft tekort 0 en geen geadviseerde bestelling als de voorraad al voldoende is", () => {
    const ruimVoorraad = [{ ...voorraadItems[0], aantal_stuks: 10000 }, voorraadItems[1]];
    const resultaat = berekenInkoopadvies(ruimVoorraad, verkoopPerArtikel, periodes, {}, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat[0].tekort).toBe(0);
    expect(resultaat[0].te_bestellen_verpakkingen).toBe(0);
  });

  it("crasht niet en geeft 0 verkoop terug als een periode ontbreekt voor een artikel", () => {
    const resultaat = berekenInkoopadvies(voorraadItems, {}, periodes, {}, {}, {
      periodeLabels: ["week-1", "week-2"],
    });
    expect(resultaat[0].gem_verkoop_per_week).toBe(0);
  });

  it("telt 'benodigd uit arrangementen' op bij de streefvoorraad en daarmee het tekort", () => {
    const zonderArrangementen = berekenInkoopadvies(voorraadItems, verkoopPerArtikel, periodes, {}, {}, {
      periodeLabels: ["week-1", "week-2"],
    })[0];
    const metArrangementen = berekenInkoopadvies(
      voorraadItems,
      verkoopPerArtikel,
      periodes,
      {},
      { "1": 50 },
      { periodeLabels: ["week-1", "week-2"] },
    )[0];
    expect(metArrangementen.benodigd_uit_arrangementen).toBe(50);
    expect(metArrangementen.streefvoorraad_stuks).toBe(zonderArrangementen.streefvoorraad_stuks + 50);
    expect(metArrangementen.tekort).toBe(zonderArrangementen.tekort + 50);
  });
});
