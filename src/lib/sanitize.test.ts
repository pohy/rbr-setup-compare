import { describe, expect, it } from "vitest";
import { getModifier, unsanitizeValue } from "./sanitize.ts";

describe("getModifier", () => {
  it("returns 0.001 for Stiffness keys", () => {
    expect(getModifier("SpringStiffness")).toBe(0.001);
    expect(getModifier("BumpStopStiffness_NGP")).toBe(0.001);
  });

  it("returns 0.001 for Damping keys", () => {
    expect(getModifier("DampingBump")).toBe(0.001);
    expect(getModifier("DampingRebound")).toBe(0.001);
    expect(getModifier("DampingBumpHighSpeed")).toBe(0.001);
  });

  it("returns 0.001 for Pressure keys", () => {
    expect(getModifier("Pressure")).toBe(0.001);
    expect(getModifier("MaxBrakePressureFront")).toBe(0.001);
  });

  it("returns 1000 for Length/Height keys", () => {
    expect(getModifier("SpringLength")).toBe(1000);
    expect(getModifier("StrutPlatformHeight")).toBe(1000);
    expect(getModifier("SteeringRodLength")).toBe(1000);
  });

  it("returns 1 for BumpHighSpeedBreak", () => {
    expect(getModifier("BumpHighSpeedBreak")).toBe(1);
  });

  it("returns 1 for Torque keys", () => {
    expect(getModifier("FrontDiffMaxTorque")).toBe(1);
    expect(getModifier("CenterDiffMaxTorque")).toBe(1);
  });

  it("returns 1 for keys without a config", () => {
    expect(getModifier("MaxSteeringLock")).toBe(1);
    expect(getModifier("TopMountSlot")).toBe(1);
  });
});

describe("unsanitizeValue", () => {
  it("converts display kN/m back to raw N/m for Stiffness", () => {
    // display: 50 kN/m → raw: 50000
    expect(unsanitizeValue("SpringStiffness", 50)).toBe(50000);
  });

  it("converts display mm back to raw m for Length", () => {
    // display: 220 mm → raw: 0.22
    expect(unsanitizeValue("SpringLength", 220)).toBe(0.22);
  });

  it("converts display kPa back to raw Pa for Pressure", () => {
    // display: 200 kPa → raw: 200000
    expect(unsanitizeValue("Pressure", 200)).toBe(200000);
  });

  it("returns identity for Torque (modifier 1)", () => {
    expect(unsanitizeValue("FrontDiffMaxTorque", 90)).toBe(90);
  });

  it("returns identity for BumpHighSpeedBreak (modifier 1)", () => {
    expect(unsanitizeValue("BumpHighSpeedBreak", 0.5)).toBe(0.5);
  });

  it("returns identity for keys without config", () => {
    expect(unsanitizeValue("MaxSteeringLock", 0.75)).toBe(0.75);
  });
});

describe("sanitize → unsanitize round-trip precision", () => {
  // sanitizeValue: raw * modifier → display
  // unsanitizeValue: display / modifier → raw
  // Round-trip: unsanitize(sanitize(raw)) should === raw

  function sanitizeNumeric(key: string, raw: number): number {
    const modifier = getModifier(key);
    // This mirrors the sanitizeValue logic: value * modifier, then cleanNumber
    return Math.round(raw * modifier * 10000) / 10000;
  }

  it.each([
    ["SpringStiffness", 50000], // 0.001 modifier
    ["SpringStiffness", 55000],
    ["SpringStiffness", 42500],
    ["SpringLength", 0.22], // 1000 modifier
    ["SpringLength", 0.155],
    ["StrutPlatformHeight", 0.085],
    ["Pressure", 200000], // 0.001 modifier
    ["Pressure", 185000],
    ["DampingBump", 3000], // 0.001 modifier
    ["DampingRebound", 4500],
    ["FrontDiffMaxTorque", 90], // 1 modifier
    ["BumpHighSpeedBreak", 0.5], // 1 modifier
    ["MaxSteeringLock", 0.75], // no config (1)
  ])("%s with raw=%s round-trips correctly", (key, rawValue) => {
    const display = sanitizeNumeric(key, rawValue);
    const backToRaw = unsanitizeValue(key, display);
    expect(backToRaw).toBeCloseTo(rawValue, 6);
  });

  it("handles fractional step values that stress floating point", () => {
    // Simulate 10 scroll steps of 500 N/m on SpringStiffness (raw)
    let raw = 50000;
    for (let i = 0; i < 10; i++) {
      raw += 500;
    }
    const display = sanitizeNumeric("SpringStiffness", raw);
    const backToRaw = unsanitizeValue("SpringStiffness", display);
    expect(backToRaw).toBeCloseTo(55000, 6);
  });
});
