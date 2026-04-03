import { describe, expect, it } from "vitest";
import { getLabel } from "./label-map.ts";

describe("getLabel", () => {
  it("returns mapped label for a direct key", () => {
    expect(getLabel("DampingBump")).toBe("Bump");
  });

  it("returns label with index for an indexed diff map key", () => {
    expect(getLabel("CenterDiffThrottle_05")).toBe("Center Throttle Lock 5");
  });

  it("strips leading zero from indexed suffix", () => {
    expect(getLabel("RearDiffBrake_00")).toBe("Rear Brake Lock 0");
  });

  it("falls back to raw key when unmapped", () => {
    expect(getLabel("SomeUnknownKey")).toBe("SomeUnknownKey");
  });
});
