import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getRangeForKey, mapRangesToSetup } from "./range-mapping.ts";
import { parseRangeFile } from "./range-parser.ts";

const RANGE_FILE = readFileSync(
  resolve(__dirname, "../../data/Skoda_Fabia_S2000_Evo_2_ngp6/r_tarmac.lsp"),
  "utf-8",
);

describe("mapRangesToSetup", () => {
  const raw = parseRangeFile(RANGE_FILE);
  const mapped = mapRangesToSetup(raw);

  it("maps SpringDamperOptionsLF → SpringDamperLF", () => {
    const section = mapped.get("SpringDamperLF");
    expect(section).toBeDefined();
    expect(section?.get("SpringStiffness")).toEqual({
      min: 15000,
      max: 100000,
      step: 100,
    });
  });

  it("maps key DampBump → DampingBump", () => {
    const section = mapped.get("SpringDamperLF");
    expect(section).toBeDefined();
    expect(section?.get("DampingBump")).toBeDefined();
    expect(section?.get("DampingBump")?.min).toBe(1000);
  });

  it("maps key PlatformHeight → StrutPlatformHeight", () => {
    const section = mapped.get("WheelLF");
    expect(section).toBeDefined();
    expect(section?.get("StrutPlatformHeight")).toEqual({
      min: 0.015,
      max: 0.05,
      step: 0.001,
    });
  });

  it("maps key SteeringRod → SteeringRodLength", () => {
    const section = mapped.get("WheelLF");
    expect(section?.get("SteeringRodLength")).toBeDefined();
  });

  it("passes through keys not in the rename table", () => {
    const section = mapped.get("SpringDamperLF");
    expect(section?.get("SpringLength")).toBeDefined();
  });

  it("maps DiffMapLockRange to all diff throttle/brake keys in VehicleControlUnit", () => {
    const section = mapped.get("VehicleControlUnit");
    expect(section).toBeDefined();

    // Should have entries for all diff map keys
    for (const prefix of ["CenterDiff", "FrontDiff", "RearDiff", "LFCenterDiff"]) {
      for (const type of ["Throttle", "Brake"]) {
        for (let i = 0; i <= 10; i++) {
          const key = `${prefix}${type}_${String(i).padStart(2, "0")}`;
          expect(section?.has(key), `expected ${key} to exist`).toBe(true);
        }
      }
    }
  });

  it("maps BumpStopStiffness_NGP to Front+Rear in Drive", () => {
    const drive = mapped.get("Drive");
    expect(drive).toBeDefined();
    expect(drive?.get("BumpStopStiffnessFront_NGP")).toEqual({
      min: 50000,
      max: 750000,
      step: 2500,
    });
    expect(drive?.get("BumpStopStiffnessRear_NGP")).toEqual({
      min: 50000,
      max: 750000,
      step: 2500,
    });
  });

  it("maps BumpStopDamping_NGP to Bump+Rebound Front+Rear", () => {
    const drive = mapped.get("Drive");
    expect(drive?.get("BumpStopDampingBumpFront_NGP")).toEqual({
      min: 5000,
      max: 75000,
      step: 250,
    });
    expect(drive?.get("BumpStopDampingBumpRear_NGP")).toBeDefined();
    expect(drive?.get("BumpStopDampingReboundFront_NGP")).toBeDefined();
    expect(drive?.get("BumpStopDampingReboundRear_NGP")).toBeDefined();
  });

  it("maps FrontBrakePressure → MaxBrakePressureFront in Drive", () => {
    const drive = mapped.get("Drive");
    expect(drive?.get("MaxBrakePressureFront")).toBeDefined();
    expect(drive?.get("MaxBrakePressureFront")?.step).toBe(10000);
  });

  it("maps CenterDiffTorque → CenterDiffMaxTorque in Drive", () => {
    const drive = mapped.get("Drive");
    expect(drive?.get("CenterDiffMaxTorque")).toBeDefined();
  });
});

describe("getRangeForKey", () => {
  const raw = parseRangeFile(RANGE_FILE);
  const mapped = mapRangesToSetup(raw);

  it("returns triplet for existing key", () => {
    const range = getRangeForKey(mapped, "SpringDamperLF", "SpringStiffness");
    expect(range).toEqual({ min: 15000, max: 100000, step: 100 });
  });

  it("returns undefined for nonexistent key", () => {
    expect(getRangeForKey(mapped, "SpringDamperLF", "NonExistent")).toBeUndefined();
  });

  it("returns undefined for nonexistent section", () => {
    expect(getRangeForKey(mapped, "NonExistent", "SpringStiffness")).toBeUndefined();
  });
});
