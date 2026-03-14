import { describe, expect, it } from "vitest";
import {
  deserializeRawRanges,
  getCarNames,
  resolveStaticRanges,
  type StaticRangesData,
} from "./static-ranges.ts";

describe("deserializeRawRanges", () => {
  it("converts serialized format to RawRangeData Map", () => {
    const data = {
      CarOptions: {
        MaxSteeringLockRange: [100, 900, 10] as [number, number, number],
      },
    };
    const result = deserializeRawRanges(data);
    expect(result.size).toBe(1);
    expect(result.get("CarOptions")?.get("MaxSteeringLockRange")).toEqual({
      min: 100,
      max: 900,
      step: 10,
    });
  });

  it("handles multiple sections and keys", () => {
    const data = {
      CarOptions: {
        MaxSteeringLockRange: [100, 900, 10] as [number, number, number],
        FrontRollBarStiffness: [0, 50000, 500] as [number, number, number],
      },
      DriveOptions: {
        CenterDiffTorque: [0, 1000, 10] as [number, number, number],
      },
    };
    const result = deserializeRawRanges(data);
    expect(result.size).toBe(2);
    expect(result.get("CarOptions")?.size).toBe(2);
    expect(result.get("DriveOptions")?.size).toBe(1);
  });

  it("returns empty map for empty input", () => {
    const result = deserializeRawRanges({});
    expect(result.size).toBe(0);
  });
});

describe("resolveStaticRanges", () => {
  it("returns null for unknown car", () => {
    expect(resolveStaticRanges({}, "Unknown")).toBeNull();
  });

  it("returns mapped RangeMap for known car", () => {
    const data: StaticRangesData = {
      "Test Car": {
        CarOptions: {
          // parseRangeFile already strips Range suffix, so the key is MaxSteeringLock
          MaxSteeringLock: [100, 900, 10],
        },
      },
    };
    const result = resolveStaticRanges(data, "Test Car");
    expect(result).not.toBeNull();
    // CarOptions should be mapped to Car
    expect(result?.has("Car")).toBe(true);
    expect(result?.get("Car")?.has("MaxSteeringLock")).toBe(true);
    expect(result?.get("Car")?.get("MaxSteeringLock")).toEqual({
      min: 100,
      max: 900,
      step: 10,
    });
  });

  it("expands DiffMapLock to all diff params", () => {
    const data: StaticRangesData = {
      "Test Car": {
        ControlOptions: {
          DiffMapLock: [0, 100, 1],
        },
      },
    };
    const result = resolveStaticRanges(data, "Test Car");
    expect(result).not.toBeNull();
    const vcu = result?.get("VehicleControlUnit");
    expect(vcu).toBeDefined();
    // DiffMapLock expands to 4 prefixes × 2 types × 11 values = 88 keys
    expect(vcu?.has("CenterDiffThrottle_00")).toBe(true);
    expect(vcu?.has("FrontDiffBrake_10")).toBe(true);
    expect(vcu?.has("RearDiffThrottle_05")).toBe(true);
    expect(vcu?.has("LFCenterDiffBrake_00")).toBe(true);
  });

  it("maps spring damper sections correctly", () => {
    const data: StaticRangesData = {
      "Test Car": {
        SpringDamperOptionsLF: {
          DampBump: [0, 20000, 100],
        },
      },
    };
    const result = resolveStaticRanges(data, "Test Car");
    expect(result).not.toBeNull();
    // Section: SpringDamperOptionsLF → SpringDamperLF
    // Key: DampBump → DampingBump
    expect(result?.get("SpringDamperLF")?.get("DampingBump")).toEqual({
      min: 0,
      max: 20000,
      step: 100,
    });
  });
});

describe("getCarNames", () => {
  it("returns sorted car names", () => {
    const data: StaticRangesData = { "Zebra Car": {}, "Alpha Car": {}, "Middle Car": {} };
    expect(getCarNames(data)).toEqual(["Alpha Car", "Middle Car", "Zebra Car"]);
  });

  it("returns empty array for empty data", () => {
    expect(getCarNames({})).toEqual([]);
  });
});
