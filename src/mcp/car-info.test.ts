import { describe, expect, it } from "vitest";
import { formatCarSummary, parseCarList, resolveCarInfo } from "./car-info.ts";

const CARLIST_FIXTURE = `; File: carList.ini
; Version: 6.175 2025-12-07

[Plugins]
plugin_physics_url=https://example.com/NGP.7z

[Categories]
Cat_1=Original
Cat_2=WRC 1.6
Cat_18=Group A8

[Car_1]
name=Citroen Xsara (0)
physics=c_xsara
cat=Original
iniFile=xsara
folder=XSARA
year=2004
weight=1400
power=300@5500
trans=4WD
link_physics=https://example.com/c_xsara.zip
link_model=

[Car_12]
name=BMW M3 E30 GrpA
physics=BMW M3 E30 GrpA
cat=Group A8
iniFile=BMW_M3_E30
folder=BMW_M3_E30
year=1990
weight=1225
power=300@8200
trans=RWD
banks=BMW_M3_E30
link_physics=https://example.com/bmw.zip
link_model=https://example.com/bmw-model.7z

[Car_95]
name=Peugeot 306 Maxi Kit Car
physics=Peugeot 306 Maxi Kit Car
cat=Group A7
year=1998
weight=1160
power=285@8700
trans=FWD
link_physics=https://example.com/306.zip

[Car_65]
name=Skoda Fabia S2000 Evo 2
physics=Skoda Fabia S2000 Evo 2
cat=Super 2000
year=2014
weight=1400
power=300@8250
trans=4WD
link_physics=https://example.com/fabia.zip
`;

describe("parseCarList", () => {
  it("parses carList.ini into a map keyed by physics name", () => {
    const map = parseCarList(CARLIST_FIXTURE);
    expect(map.size).toBe(4);
    expect(map.has("BMW M3 E30 GrpA")).toBe(true);
    expect(map.has("c_xsara")).toBe(true);
  });

  it("extracts all fields correctly", () => {
    const map = parseCarList(CARLIST_FIXTURE);
    const bmw = map.get("BMW M3 E30 GrpA");
    expect(bmw).toEqual({
      name: "BMW M3 E30 GrpA",
      drivetrain: "RWD",
      weight: 1225,
      power: "300@8200",
      year: 1990,
      category: "Group A8",
    });
  });

  it("handles FWD and 4WD drivetrains", () => {
    const map = parseCarList(CARLIST_FIXTURE);
    expect(map.get("Peugeot 306 Maxi Kit Car")?.drivetrain).toBe("FWD");
    expect(map.get("Skoda Fabia S2000 Evo 2")?.drivetrain).toBe("4WD");
  });

  it("skips commented-out car sections", () => {
    const input = `;[Car_99]
;name=Ghost Car
;physics=Ghost Car
;cat=Group B
;year=1985
;weight=1200
;power=400@7000
;trans=4WD

[Car_1]
name=Real Car
physics=Real Car
cat=Original
year=2004
weight=1400
power=300@5500
trans=4WD
`;
    const map = parseCarList(input);
    expect(map.size).toBe(1);
    expect(map.has("Real Car")).toBe(true);
    expect(map.has("Ghost Car")).toBe(false);
  });

  it("handles Windows line endings", () => {
    const windowsInput = CARLIST_FIXTURE.replace(/\n/g, "\r\n");
    const map = parseCarList(windowsInput);
    expect(map.size).toBe(4);
    expect(map.get("BMW M3 E30 GrpA")?.drivetrain).toBe("RWD");
  });

  it("returns empty map for empty input", () => {
    expect(parseCarList("").size).toBe(0);
    expect(parseCarList("; just comments\n[Plugins]\nfoo=bar").size).toBe(0);
  });
});

describe("resolveCarInfo", () => {
  it("returns matching car info by physics name", () => {
    const map = parseCarList(CARLIST_FIXTURE);
    const info = resolveCarInfo(map, "BMW M3 E30 GrpA");
    expect(info?.drivetrain).toBe("RWD");
  });

  it("returns null for unknown car", () => {
    const map = parseCarList(CARLIST_FIXTURE);
    expect(resolveCarInfo(map, "Unknown Car")).toBeNull();
  });
});

describe("formatCarSummary", () => {
  it("formats a one-liner summary", () => {
    const summary = formatCarSummary({
      name: "Skoda Fabia R5 evo",
      drivetrain: "4WD",
      weight: 1430,
      power: "285@5000",
      year: 2019,
      category: "Group R5",
    });
    expect(summary).toBe("4WD | 1430 kg | 285 bhp @ 5000 rpm | Group R5 | 2019");
  });

  it("formats power without RPM if missing @", () => {
    const summary = formatCarSummary({
      name: "Test",
      drivetrain: "FWD",
      weight: 940,
      power: "115",
      year: 1993,
      category: "Group A5",
    });
    expect(summary).toBe("FWD | 940 kg | 115 bhp | Group A5 | 1993");
  });
});
