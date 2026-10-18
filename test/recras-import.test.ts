import { describe, expect, it } from "vitest";
import {
  matchRecrasRegels,
  parseRecrasRijen,
  vindOngematchteProducten,
  type RecrasRegel,
} from "../src/lib/recras-import";
import type { Arrangement } from "../src/types/sligro";

describe("parseRecrasRijen", () => {
  it("zet een ruwe RECRAS-rij om naar een genormaliseerde regel", () => {
    const rijen = [
      {
        Boeking: "29631-1",
        Product: "Glow Table Games",
        Begindatum: new Date("2026-10-27T14:00:00Z"),
        Aantal: 20,
        Boekingsnaam: "Glow Meeting halve dag met Glow-MiBo Deluxe",
        Status: "definitief",
      },
    ];
    expect(parseRecrasRijen(rijen)).toEqual([
      {
        recras_boeking: "29631-1",
        product_naam: "Glow Table Games",
        aantal: 20,
        datum: "2026-10-27",
        boekingsnaam: "Glow Meeting halve dag met Glow-MiBo Deluxe",
        status: "definitief",
      },
    ]);
  });

  it("herkent een datum als tekst ('2026-10-27 00:00:00')", () => {
    const rijen = [{ Boeking: "1", Product: "X", Begindatum: "2026-10-27 00:00:00", Aantal: 1, Status: "optie" }];
    expect(parseRecrasRijen(rijen)[0].datum).toBe("2026-10-27");
  });

  it("herkent een Excel-seriegetal als datum (cel zonder datumopmaak)", () => {
    // 46322 = 2026-10-27 (dagen sinds 1899-12-30)
    const rijen = [{ Boeking: "1", Product: "X", Begindatum: 46322, Aantal: 1, Status: "optie" }];
    expect(parseRecrasRijen(rijen)[0].datum).toBe("2026-10-27");
  });

  it("slaat rijen zonder boekingnummer, productnaam of geldige datum over", () => {
    const rijen = [
      { Boeking: "", Product: "X", Begindatum: "2026-10-27", Aantal: 1, Status: "definitief" },
      { Boeking: "1", Product: "", Begindatum: "2026-10-27", Aantal: 1, Status: "definitief" },
      { Boeking: "1", Product: "X", Begindatum: "", Aantal: 1, Status: "definitief" },
    ];
    expect(parseRecrasRijen(rijen)).toEqual([]);
  });

  it("valt terug op 'optie' bij een onbekende of lege status", () => {
    const rijen = [{ Boeking: "1", Product: "X", Begindatum: "2026-10-27", Aantal: 1, Status: "" }];
    expect(parseRecrasRijen(rijen)[0].status).toBe("optie");
  });
});

describe("matchRecrasRegels + vindOngematchteProducten", () => {
  const arrangementen: Arrangement[] = [
    { id: "a1", naam: "Drankarrangement 3 uur", status: "zeker", items: [] },
  ];

  const regels: RecrasRegel[] = [
    {
      recras_boeking: "1",
      product_naam: "drankarrangement 3 uur  ",
      aantal: 10,
      datum: "2026-10-27",
      boekingsnaam: "Feest",
      status: "definitief",
    },
    {
      recras_boeking: "1",
      product_naam: "WGW Barbecue buffet",
      aantal: 10,
      datum: "2026-10-27",
      boekingsnaam: "Feest",
      status: "definitief",
    },
    {
      recras_boeking: "2",
      product_naam: "WGW Barbecue buffet",
      aantal: 5,
      datum: "2026-10-28",
      boekingsnaam: "Teamdag",
      status: "optie",
    },
  ];

  it("matcht op naam ongeacht hoofdletters/spaties", () => {
    const resultaat = matchRecrasRegels(regels, arrangementen);
    expect(resultaat[0].arrangement_id).toBe("a1");
  });

  it("laat arrangement_id null voor een product zonder bestaand sjabloon", () => {
    const resultaat = matchRecrasRegels(regels, arrangementen);
    expect(resultaat[1].arrangement_id).toBeNull();
    expect(resultaat[2].arrangement_id).toBeNull();
  });

  it("geeft elke ongematchte productnaam één keer terug, in volgorde van eerste voorkomen", () => {
    const resultaat = matchRecrasRegels(regels, arrangementen);
    expect(vindOngematchteProducten(resultaat)).toEqual(["WGW Barbecue buffet"]);
  });
});
