import { describe, expect, it } from "vitest";
import { compareSetups } from "./compare.ts";
import type { CarSetup } from "./lsp-parser.ts";
import type { RangeMap } from "./range-mapping.ts";

function makeSetup(
  name: string,
  sections: Record<string, Record<string, number | string>>,
): CarSetup {
  const built: CarSetup["sections"] = {};
  for (const [sectionName, values] of Object.entries(sections)) {
    built[sectionName] = { id: ":-D", values: { ...values } };
  }
  return { name, sections: built };
}

function findRow(result: ReturnType<typeof compareSetups>, section: string, key: string) {
  const sec = result.find((s) => s.sectionName === section);
  const row = sec?.rows.find((r) => r.type === "data" && r.key === key);
  if (!row || row.type !== "data") {
    throw new Error(`row ${section}.${key} not found`);
  }
  return row;
}

describe("compareSetups isReadonly", () => {
  it("marks non-whitelisted keys as readonly", () => {
    const setups = [
      makeSetup("a.lsp", { Drive: { GearId2: 3 } }),
      makeSetup("b.lsp", { Drive: { GearId2: 4 } }),
    ];
    const result = compareSetups(setups);
    const row = findRow(result, "Drive", "GearId2");
    expect(row.isReadonly).toBe(true);
  });

  it("marks whitelisted keys as editable when no range is supplied", () => {
    const setups = [
      makeSetup("a.lsp", { Drive: { DropGearId: 10 } }),
      makeSetup("b.lsp", { Drive: { DropGearId: 11 } }),
    ];
    const result = compareSetups(setups);
    const row = findRow(result, "Drive", "DropGearId");
    expect(row.isReadonly).toBe(false);
  });

  it("marks whitelisted key readonly when range triplet is all zeros", () => {
    const setups = [
      makeSetup("a.lsp", { Car: { MaxSteeringLock: 0.5 } }),
      makeSetup("b.lsp", { Car: { MaxSteeringLock: 0.6 } }),
    ];
    const ranges: RangeMap = new Map([
      ["Car", new Map([["MaxSteeringLock", { min: 0, max: 0, step: 0 }]])],
    ]);
    const result = compareSetups(setups, ranges);
    const row = findRow(result, "Car", "MaxSteeringLock");
    expect(row.isReadonly).toBe(true);
  });

  it("marks whitelisted key readonly when min >= max", () => {
    const setups = [
      makeSetup("a.lsp", { Car: { FrontRollBarStiffness: 30000 } }),
      makeSetup("b.lsp", { Car: { FrontRollBarStiffness: 40000 } }),
    ];
    const ranges: RangeMap = new Map([
      ["Car", new Map([["FrontRollBarStiffness", { min: 30000, max: 30000, step: 0 }]])],
    ]);
    const result = compareSetups(setups, ranges);
    const row = findRow(result, "Car", "FrontRollBarStiffness");
    expect(row.isReadonly).toBe(true);
  });

  it("keeps whitelisted key editable when range is valid", () => {
    const setups = [
      makeSetup("a.lsp", { Car: { MaxSteeringLock: 0.5 } }),
      makeSetup("b.lsp", { Car: { MaxSteeringLock: 0.6 } }),
    ];
    const ranges: RangeMap = new Map([
      ["Car", new Map([["MaxSteeringLock", { min: 0.3, max: 0.9, step: 0.01 }]])],
    ]);
    const result = compareSetups(setups, ranges);
    const row = findRow(result, "Car", "MaxSteeringLock");
    expect(row.isReadonly).toBe(false);
  });

  it("uses raw section name for whitelist/range lookup after SECTION_RENAMES", () => {
    // SpringDamperLB is renamed to SpringDamperBack in display output,
    // but whitelist + range map use the raw key SpringDamperLB.
    const setups = [
      makeSetup("a.lsp", { SpringDamperLB: { SpringStiffness: 30000 } }),
      makeSetup("b.lsp", { SpringDamperLB: { SpringStiffness: 40000 } }),
    ];
    const ranges: RangeMap = new Map([
      ["SpringDamperLB", new Map([["SpringStiffness", { min: 20000, max: 80000, step: 1000 }]])],
    ]);
    const result = compareSetups(setups, ranges);
    // Display section is "SpringDamperBack".
    const row = findRow(result, "SpringDamperBack", "SpringStiffness");
    expect(row.isReadonly).toBe(false);
  });
});
