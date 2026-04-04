import { describe, expect, it } from "vitest";
import {
  ApplyChangesInput,
  ChangeEntry,
  CompareSetupsInput,
  ListCarsInput,
  ProposeChangeInput,
  ReadRangesInput,
  ReadSetupInput,
  SetRbrDirectoryInput,
} from "./schemas.ts";

describe("ChangeEntry", () => {
  it("accepts absolute mode", () => {
    const result = ChangeEntry.safeParse({
      section: "Car",
      key: "MaxSteeringLock",
      change: { mode: "absolute", value: 540 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts relative mode", () => {
    const result = ChangeEntry.safeParse({
      section: "SpringDamperFront",
      key: "SpringStiffness",
      change: { mode: "relative", percent: 5 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown mode", () => {
    const result = ChangeEntry.safeParse({
      section: "Car",
      key: "MaxSteeringLock",
      change: { mode: "increment", value: 10 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing section", () => {
    const result = ChangeEntry.safeParse({
      key: "MaxSteeringLock",
      change: { mode: "absolute", value: 540 },
    });
    expect(result.success).toBe(false);
  });
});

describe("SetRbrDirectoryInput", () => {
  it("accepts a path string", () => {
    const result = SetRbrDirectoryInput.safeParse({ path: "/mnt/e/Games/RBR" });
    expect(result.success).toBe(true);
  });

  it("rejects empty path", () => {
    const result = SetRbrDirectoryInput.safeParse({ path: "" });
    expect(result.success).toBe(false);
  });
});

describe("ListCarsInput", () => {
  it("accepts empty object", () => {
    expect(ListCarsInput.safeParse({}).success).toBe(true);
  });
});

describe("ReadSetupInput", () => {
  it("accepts car and file", () => {
    const result = ReadSetupInput.safeParse({ car: "Impreza03", file: "d_gravel.lsp" });
    expect(result.success).toBe(true);
  });

  it("rejects missing file", () => {
    expect(ReadSetupInput.safeParse({ car: "Impreza03" }).success).toBe(false);
  });
});

describe("ReadRangesInput", () => {
  it("accepts car and surface", () => {
    const result = ReadRangesInput.safeParse({ car: "Impreza03", surface: "gravel" });
    expect(result.success).toBe(true);
  });
});

describe("CompareSetupsInput", () => {
  it("accepts 2+ files", () => {
    const result = CompareSetupsInput.safeParse({
      car: "Impreza03",
      files: ["d_gravel.lsp", "d_tarmac.lsp"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects single file", () => {
    const result = CompareSetupsInput.safeParse({
      car: "Impreza03",
      files: ["d_gravel.lsp"],
    });
    expect(result.success).toBe(false);
  });
});

describe("ProposeChangeInput", () => {
  it("accepts valid proposal", () => {
    const result = ProposeChangeInput.safeParse({
      car: "Impreza03",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 540 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty changes array", () => {
    const result = ProposeChangeInput.safeParse({
      car: "Impreza03",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("ApplyChangesInput", () => {
  it("accepts with optional fields", () => {
    const result = ApplyChangesInput.safeParse({
      car: "Impreza03",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "relative", percent: -5 } },
      ],
      targetFile: "custom_gravel.lsp",
      base: "d_gravel.lsp",
      meta: { purpose: "less oversteer" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts without optional fields", () => {
    const result = ApplyChangesInput.safeParse({
      car: "Impreza03",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 540 } },
      ],
    });
    expect(result.success).toBe(true);
  });
});
