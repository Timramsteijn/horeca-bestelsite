import { describe, expect, it } from "vitest";
import { parseCsv, parseGetal, vindKolom } from "../src/lib/csv";
import { buildTelsheetCsv, parseTelsheetCsv } from "../src/lib/telsheet";
import { parseLightspeedReport, matchLightspeedRijen, extractPeriode } from "../src/lib/lightspeed-import";
import type { KoppeltabelRow, VoorraadItem } from "../src/types/sligro";

describe("parseCsv", () => {
  it("detecteert puntkomma als scheidingsteken", () => {
    const { delimiter, rows } = parseCsv("a;b;c\n1;2;3");
    expect(delimiter).toBe(";");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("detecteert komma als scheidingsteken", () => {
    const { delimiter, rows } = parseCsv("a,b,c\n1,2,3");
    expect(delimiter).toBe(",");
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });

  it("strip een BOM aan het begin", () => {
    const { rows } = parseCsv("﻿a;b\n1;2");
    expect(rows[0]).toEqual(["a", "b"]);
  });

  it("laat lege regels weg", () => {
    const { rows } = parseCsv("a;b\n\n1;2\n\n");
    expect(rows).toHaveLength(2);
  });

  it("ondersteunt quoted fields met scheidingstekens erin", () => {
    const { rows } = parseCsv('naam;omschrijving\nCola;"Krat, 24 stuks"');
    expect(rows[1]).toEqual(["Cola", "Krat, 24 stuks"]);
  });
});

describe("parseGetal", () => {
  it("parset een komma als decimaalteken", () => {
    expect(parseGetal("12,5")).toBe(12.5);
  });
  it("parset een punt als decimaalteken", () => {
    expect(parseGetal("12.5")).toBe(12.5);
  });
  it("geeft null voor niet-numerieke waarden", () => {
    expect(parseGetal("abc")).toBeNull();
    expect(parseGetal("")).toBeNull();
  });
});

describe("vindKolom", () => {
  it("vindt de kolom die matcht met een patroon, case-insensitive", () => {
    expect(vindKolom(["Artikelnummer", "Omschrijving"], [/artikelnummer/i])).toBe(0);
    expect(vindKolom(["Artikelnummer", "Omschrijving"], [/geen match/i])).toBe(-1);
  });
});

describe("telsheet export/import round-trip", () => {
  const items: VoorraadItem[] = [
    {
      artikelnummer: "192603",
      omschrijving: "Coca-Cola Cola regular Krat 24 flesjes x 20 cl",
      aantal_stuks: 137,
      verpakkingsgrootte: 24,
      laatst_bijgewerkt: "2026-09-23",
      laatste_telling: "2026-09-13",
      status: "zeker",
      arrangement_alleen: false,
      mutaties: [],
    },
  ];

  it("exporteert met de juiste kolommen en laat getelde_voorraad leeg", () => {
    const csv = buildTelsheetCsv(items);
    expect(csv).toContain("sligro_artikelnummer;artikel;huidige_voorraad;getelde_voorraad");
    expect(csv).toContain("192603;Coca-Cola Cola regular Krat 24 flesjes x 20 cl;137;");
  });

  it("importeert een ingevulde telsheet en slaat lege regels over", () => {
    const csv =
      "sligro_artikelnummer;artikel;huidige_voorraad;getelde_voorraad\n" +
      "192603;Cola;137;140\n" +
      "999999;Onbekend;0;\n";
    const result = parseTelsheetCsv(csv);
    expect(result.regels).toEqual([{ artikelnummer: "192603", aantal: 140 }]);
    expect(result.overgeslagen).toBe(1);
  });

  it("herkent kop-varianten (komma-gescheiden, 'geteld' i.p.v. 'getelde_voorraad')", () => {
    const csv = "artikelnummer,naam,voorraad,geteld\n192603,Cola,137,99";
    const result = parseTelsheetCsv(csv);
    expect(result.regels).toEqual([{ artikelnummer: "192603", aantal: 99 }]);
  });
});

describe("parseLightspeedReport", () => {
  it("vindt de kopregel na een preambule en leest tot de volgende lege regel", () => {
    const text = [
      "PRODUCT SUMMARY REPORT;",
      "from: 14-9-26 4:00;",
      "",
      "DISCOUNTS BY TYPE;",
      "TYPE;TOTAL;#;",
      "Korting;-1.00;1;",
      "",
      "PRODUCT REVENUES;",
      "PRODUCT;VAT RATE;VAT;PID;AMOUNT;PRICE;TOTAL;",
      "Cola;9;18.58;b1;60;3.75;225.00;",
      "Cola Zero;9;26.94;b3;87;3.75;326.25;",
      "",
      "iets wat hierna komt;",
    ].join("\n");

    const rijen = parseLightspeedReport(text);
    expect(rijen).toEqual([
      { pid: "b1", naam: "Cola", aantal: 60 },
      { pid: "b3", naam: "Cola Zero", aantal: 87 },
    ]);
  });

  it("geeft lege lijst als er geen herkenbare kop gevonden wordt", () => {
    expect(parseLightspeedReport("willekeurige tekst\nmeer tekst")).toEqual([]);
  });
});

describe("extractPeriode", () => {
  it("leest de from/to-regels en zet ze om naar een periodelabel + weken", () => {
    const text = 'PRODUCT SUMMARY REPORT;\nfrom: 14-9-26 4:00 +0200;" ";to: 5-10-26 4:00 +0200;\n';
    expect(extractPeriode(text)).toEqual({ label: "2026-09-14 - 2026-10-05", weken: 3 });
  });

  it("geeft null als er geen from/to gevonden wordt", () => {
    expect(extractPeriode("iets anders")).toBeNull();
  });
});

describe("matchLightspeedRijen", () => {
  const koppeltabel: KoppeltabelRow[] = [
    {
      pid: "b1",
      productnaam: "Cola",
      artikelnummer: "192603",
      omschrijving: "Coca-Cola Cola regular Krat 24 flesjes x 20 cl",
      aantal_per_verpakking: 24,
      status: "zeker",
      notitie: "",
    },
    {
      pid: "b3",
      productnaam: "Cola Zero",
      artikelnummer: "940174",
      omschrijving: "Coca-Cola Cola zero sugar Krat 24 flesjes x 20 cl",
      aantal_per_verpakking: 24,
      status: "zeker",
      notitie: "",
    },
    {
      pid: "Dl105",
      productnaam: "Frisdrank take away",
      artikelnummer: "000000",
      omschrijving: "Verzamelartikel",
      aantal_per_verpakking: 1,
      status: "mix",
      notitie: "",
    },
    {
      pid: "nvt1",
      productnaam: "Statiegeld",
      artikelnummer: "",
      omschrijving: "",
      aantal_per_verpakking: 1,
      status: "nvt",
      notitie: "",
    },
  ];

  it("matcht op exacte PID", () => {
    const result = matchLightspeedRijen([{ pid: "b1", naam: "Cola", aantal: 60 }], koppeltabel);
    expect(result.perArtikel).toEqual({ "192603": 60 });
  });

  it("matcht op exacte productnaam als er geen PID-match is", () => {
    const result = matchLightspeedRijen([{ pid: null, naam: "Cola", aantal: 10 }], koppeltabel);
    expect(result.perArtikel).toEqual({ "192603": 10 });
  });

  it("matcht gedeeltelijk op de eerste twee woorden", () => {
    const result = matchLightspeedRijen(
      [{ pid: null, naam: "Cola Zero sugar blikje", aantal: 5 }],
      koppeltabel,
    );
    expect(result.perArtikel).toEqual({ "940174": 5 });
  });

  it("telt niet-matchende regels apart, los van nvt-regels", () => {
    const result = matchLightspeedRijen(
      [
        { pid: null, naam: "Onbekend product", aantal: 3 },
        { pid: "nvt1", naam: "Statiegeld", aantal: 2 },
      ],
      koppeltabel,
    );
    expect(result.perArtikel).toEqual({});
    expect(result.nietGekoppeld).toEqual([{ naam: "Onbekend product", aantal: 3 }]);
  });

  it("houdt mix-artikelen apart i.p.v. automatisch te verdelen", () => {
    const result = matchLightspeedRijen(
      [{ pid: "Dl105", naam: "Frisdrank take away", aantal: 20 }],
      koppeltabel,
    );
    expect(result.perArtikel).toEqual({});
    expect(result.mixArtikelen).toEqual([{ naam: "Frisdrank take away", aantal: 20 }]);
  });
});
