import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareSetups } from "./compare.ts";
import type { CarSetup } from "./lsp-parser.ts";
import { parseLspSetup } from "./lsp-parser.ts";
import { buildShareUrl, hydrateFromUrl } from "./url-sharing.ts";

const DATA_DIR = resolve(process.cwd(), "data");

function loadRawSetup(path: string) {
  const content = readFileSync(resolve(DATA_DIR, path), "utf-8");
  return parseLspSetup(content, path);
}

describe("URL sharing round-trip", () => {
  let locationMock: { origin: string; pathname: string; hash: string };

  beforeEach(() => {
    locationMock = { origin: "https://example.com", pathname: "/", hash: "" };
    vi.stubGlobal("window", { location: locationMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("raw setups use LF/LB section names, not sanitized Front/Back names", () => {
    const setup = loadRawSetup("Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp");

    expect(setup.sections).toHaveProperty("SpringDamperLF");
    expect(setup.sections).toHaveProperty("TyreLF");
    expect(setup.sections).toHaveProperty("WheelLF");

    expect(setup.sections).not.toHaveProperty("SpringDamperFront");
    expect(setup.sections).not.toHaveProperty("TyreFront");
    expect(setup.sections).not.toHaveProperty("WheelFront");
  });

  it("preserves all sections and values through buildShareUrl -> hydrateFromUrl -> compareSetups", () => {
    const setups = [
      loadRawSetup("Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp"),
      loadRawSetup("Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_gravel.lsp"),
    ];

    const result = buildShareUrl(setups, false);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("buildShareUrl failed");

    // Set hash from the built URL so hydrateFromUrl can read it
    const hashIndex = result.url.indexOf("#");
    locationMock.hash = result.url.slice(hashIndex);

    const hydrated = hydrateFromUrl();
    expect(hydrated.found).toBe(true);
    if (!hydrated.found) throw new Error("hydrateFromUrl failed");

    const originalComparison = compareSetups(setups);
    const hydratedComparison = compareSetups(hydrated.setups);

    // Same sections should be present
    const originalSections = originalComparison.map((s) => s.sectionName);
    const hydratedSections = hydratedComparison.map((s) => s.sectionName);
    expect(hydratedSections).toEqual(originalSections);

    // These sections exist after sanitization by compareSetups.
    // They only appear if the schema correctly maps raw LF/LB names.
    expect(originalSections).toContain("SpringDamperFront");
    expect(originalSections).toContain("WheelFront");
    expect(originalSections).toContain("TyreFront");

    // Row order must be identical between file-loaded and URL-hydrated comparisons
    expect(hydratedComparison).toEqual(originalComparison);
  });

  it("compareSetups produces identical order regardless of input property insertion order", () => {
    // Simulate file-loaded order: Car, Drive, SpringDamperLF, WheelLF
    const fileOrder: CarSetup = {
      name: "file",
      sections: {
        Car: { id: "", values: { MaxSteeringLock: 0.8, FrontRollBarStiffness: 20000 } },
        Drive: { id: "", values: { FrontDiffMaxTorque: 90 } },
        SpringDamperLF: { id: "", values: { SpringLength: 0.2, DampingBump: 5000 } },
        SpringDamperLB: { id: "", values: { SpringLength: 0.21, DampingBump: 4500 } },
        WheelLF: { id: "", values: { TopMountSlot: 1 } },
        WheelLB: { id: "", values: { TopMountSlot: 2 } },
      },
    };

    // Simulate URL-hydrated order (SETUP_SCHEMA order): Car, Drive, WheelLF, SpringDamperLF
    const schemaOrder: CarSetup = {
      name: "schema",
      sections: {
        Car: { id: "", values: { MaxSteeringLock: 0.7, FrontRollBarStiffness: 18000 } },
        Drive: { id: "", values: { FrontDiffMaxTorque: 80 } },
        WheelLF: { id: "", values: { TopMountSlot: 3 } },
        WheelLB: { id: "", values: { TopMountSlot: 4 } },
        SpringDamperLF: { id: "", values: { SpringLength: 0.19, DampingBump: 4800 } },
        SpringDamperLB: { id: "", values: { SpringLength: 0.2, DampingBump: 4200 } },
      },
    };

    const result1 = compareSetups([fileOrder, schemaOrder]);
    const result2 = compareSetups([schemaOrder, fileOrder]);

    const sections1 = result1.map((s) => s.sectionName);
    const sections2 = result2.map((s) => s.sectionName);
    expect(sections1).toEqual(sections2);
  });
});
