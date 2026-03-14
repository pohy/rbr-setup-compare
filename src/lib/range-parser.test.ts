import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRangeFile } from "./range-parser.ts";

const RANGE_FILE = readFileSync(
  resolve(__dirname, "../../data/Skoda_Fabia_S2000_Evo_2_ngp6/r_tarmac.lsp"),
  "utf-8",
);

describe("parseRangeFile", () => {
  const result = parseRangeFile(RANGE_FILE);

  it("parses SpringStiffnessMax/Min/Step in SpringDamperOptionsLF", () => {
    const section = result.get("SpringDamperOptionsLF");
    expect(section).toBeDefined();
    expect(section?.get("SpringStiffness")).toEqual({
      min: 15000,
      max: 100000,
      step: 100,
    });
  });

  it("parses MaxSteeringLockRange{Max,Min,Step} in CarOptions", () => {
    const section = result.get("CarOptions");
    expect(section).toBeDefined();
    expect(section?.get("MaxSteeringLock")).toEqual({
      min: 0.749,
      max: 0.751,
      step: 0.01,
    });
  });

  it("parses BumpStopStiffness{Max,Min,Step}_NGP in DriveOptions", () => {
    const section = result.get("DriveOptions");
    expect(section).toBeDefined();
    expect(section?.get("BumpStopStiffness_NGP")).toEqual({
      min: 50000,
      max: 750000,
      step: 2500,
    });
  });

  it("ignores non-triplet keys like vecCenterOfGravity, InverseMass", () => {
    const car = result.get("CarOptions");
    expect(car).toBeDefined();
    // These keys should not appear as triplet bases
    expect(car?.has("vecCenterOfGravity")).toBe(false);
    expect(car?.has("InverseMass")).toBe(false);
  });

  it("returns all sections that contain triplets", () => {
    // CarOptions, DriveOptions, ControlOptions,
    // SpringDamperOptions{LF,RF,LB,RB}, TyreOptions{LF,RF,LB,RB}, WheelOptions{LF,RF,LB,RB}
    expect(result.size).toBe(15);
  });

  it("handles DiffMapLockRange{Max,Min,Step} in ControlOptions", () => {
    const section = result.get("ControlOptions");
    expect(section).toBeDefined();
    expect(section?.get("DiffMapLock")).toEqual({
      min: 0,
      max: 0.75,
      step: 0.05,
    });
  });

  it("parses BumpStopDamping_NGP triplet in DriveOptions", () => {
    const section = result.get("DriveOptions");
    expect(section?.get("BumpStopDamping_NGP")).toEqual({
      min: 5000,
      max: 75000,
      step: 250,
    });
  });

  it("parses Pressure triplet in TyreOptionsLF", () => {
    const section = result.get("TyreOptionsLF");
    expect(section).toBeDefined();
    expect(section?.get("Pressure")).toEqual({
      min: 150000,
      max: 350000,
      step: 1000,
    });
  });

  it("parses WheelOptions triplets", () => {
    const section = result.get("WheelOptionsLF");
    expect(section).toBeDefined();
    expect(section?.get("SteeringRod")).toEqual({
      min: 0.447,
      max: 0.457,
      step: 0.00001,
    });
    expect(section?.get("PlatformHeight")).toEqual({
      min: 0.015,
      max: 0.05,
      step: 0.001,
    });
  });
});
