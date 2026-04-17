import { describe, expect, it } from "vitest";
import { isWhitelistedPath } from "./field-defs.ts";

describe("isWhitelistedPath", () => {
  it("accepts Car.MaxSteeringLock", () => {
    expect(isWhitelistedPath("Car", "MaxSteeringLock")).toBe(true);
  });

  it("accepts Drive.DropGearId (editable gear)", () => {
    expect(isWhitelistedPath("Drive", "DropGearId")).toBe(true);
  });

  it("rejects GearId0..7 (NGP hijacked gears)", () => {
    for (let i = 0; i <= 7; i++) {
      expect(isWhitelistedPath("Drive", `GearId${i}`)).toBe(false);
    }
  });

  it("rejects FinalDriveId", () => {
    expect(isWhitelistedPath("Drive", "FinalDriveId")).toBe(false);
  });

  it("accepts springs/dampers on L-side only (mirror auto-applied)", () => {
    expect(isWhitelistedPath("SpringDamperLF", "SpringStiffness")).toBe(true);
    expect(isWhitelistedPath("SpringDamperLB", "DampingBump")).toBe(true);
  });

  it("rejects R-side sections (mirrors discarded by compare)", () => {
    expect(isWhitelistedPath("SpringDamperRF", "SpringStiffness")).toBe(false);
    expect(isWhitelistedPath("WheelRB", "WheelAxisInclination")).toBe(false);
  });

  it("accepts indexed diff-map curve points", () => {
    expect(isWhitelistedPath("VehicleControlUnit", "CenterDiffThrottle_00")).toBe(true);
    expect(isWhitelistedPath("VehicleControlUnit", "FrontDiffBrake_10")).toBe(true);
    expect(isWhitelistedPath("VehicleControlUnit", "LFCenterDiffThrottle_05")).toBe(true);
    expect(isWhitelistedPath("VehicleControlUnit", "RearDiffBrake_07")).toBe(true);
  });

  it("rejects SpeedMap keys (not in whitelist)", () => {
    expect(isWhitelistedPath("VehicleControlUnit", "CenterSpeedMapVelocity_00")).toBe(false);
  });

  it("accepts VCU handbrake release + left-foot brake threshold", () => {
    expect(isWhitelistedPath("VehicleControlUnit", "CenterDiffHandbrakeRelease")).toBe(true);
    expect(isWhitelistedPath("VehicleControlUnit", "LeftFootBrakeThreshold")).toBe(true);
  });

  it("accepts bump stop NGP fields", () => {
    expect(isWhitelistedPath("Drive", "BumpStopStiffnessFront_NGP")).toBe(true);
    expect(isWhitelistedPath("Drive", "BumpStopDampingReboundRear_NGP")).toBe(true);
  });

  it("accepts fast rebound NGP fields", () => {
    expect(isWhitelistedPath("Drive", "HighSpeedBreakReboundFront_NGP")).toBe(true);
    expect(isWhitelistedPath("Drive", "HighSpeedDampingReboundRear_NGP")).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(isWhitelistedPath("Car", "Bogus")).toBe(false);
    expect(isWhitelistedPath("Engine", "Features_NGP")).toBe(false);
  });
});
