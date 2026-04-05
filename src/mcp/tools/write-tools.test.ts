import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanRbrDirectory } from "../../lib/rbr-scanner.ts";
import type { McpContext } from "../context.ts";
import { isMcpManaged, readMcpSidecar } from "../mcp-managed.ts";
import { NodeDirectoryHandle } from "../node-fs-adapter.ts";
import { applyChanges } from "./apply-changes.ts";
import { proposeChange } from "./propose-change.ts";

const TEST_DIR = join(tmpdir(), "rbr-mcp-write-test");
const CAR_DIR = "TestCar_ngp6";

const SETUP_CONTENT = `(("CarSetup"
  Car
  ("Car"
   MaxSteeringLock 0.75
   FrontRollBarStiffness 12000
   RearRollBarStiffness 8000
   )
  Drive
  (":-D"
   FinalDriveRatio 4.5
   )
  Engine
  (":-D"
   Features_NGP 0
   )
  WheelLF
  (":-D"
   vecTopMountPosition +0.526 -2.416 +0.710
   TopMountSlot 3
   )
  WheelRF
  (":-D"
   vecTopMountPosition -0.526 -2.416 +0.710
   TopMountSlot 3
   )
  WheelLB
  (":-D"
   vecTopMountPosition +0.500 +0.000 +0.740
   TopMountSlot 0
   )
  WheelRB
  (":-D"
   vecTopMountPosition -0.500 +0.000 +0.740
   TopMountSlot 0
   )
  SpringDamperLF
  (":-D"
   SpringStiffness 38000
   DampingBump 4950
   )
  SpringDamperRF
  (":-D"
   SpringStiffness 38000
   DampingBump 4800
   )
  SpringDamperLB
  (":-D"
   SpringStiffness 31600
   DampingBump 4100
   )
  SpringDamperRB
  (":-D"
   SpringStiffness 31600
   DampingBump 4100
   )
  TyreLF
  (":-D"
   Pressure 220000
   )
  TyreRF
  (":-D"
   Pressure 220000
   )
  TyreLB
  (":-D"
   Pressure 220000
   )
  TyreRB
  (":-D"
   Pressure 220000
   )
))`;

const RANGE_CONTENT = `(("(null)"
  CarOptions
  ("(null)"
   MaxSteeringLockRangeMin 0.5
   MaxSteeringLockRangeMax 0.9
   MaxSteeringLockRangeStep 0.01
   FrontRollBarStiffnessMin 5000
   FrontRollBarStiffnessMax 20000
   FrontRollBarStiffnessStep 500
   RearRollBarStiffnessMin 3000
   RearRollBarStiffnessMax 15000
   RearRollBarStiffnessStep 500
   )
))`;

let ctx: McpContext;

beforeAll(async () => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  const setupsDir = join(TEST_DIR, "rsfdata", "cars", CAR_DIR, "setups");
  mkdirSync(setupsDir, { recursive: true });
  mkdirSync(join(TEST_DIR, "SavedGames"), { recursive: true });
  writeFileSync(join(setupsDir, "d_gravel.lsp"), SETUP_CONTENT);
  writeFileSync(join(TEST_DIR, "rsfdata", "cars", CAR_DIR, "r_gravel.lsp"), RANGE_CONTENT);

  const root = new NodeDirectoryHandle(TEST_DIR);
  const carGroups = await scanRbrDirectory(root);
  ctx = { projectRoot: TEST_DIR, rbrDir: TEST_DIR, carGroups };
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("proposeChange", () => {
  it("returns preview with absolute change", async () => {
    const result = await proposeChange(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 0.8 } },
      ],
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(data).toHaveLength(1);
    expect(data[0].key).toBe("MaxSteeringLock");
    expect(data[0].before).toBe(0.75);
    expect(data[0].after).toBe(0.8);
    expect(data[0].wasClamped).toBe(false);
  });

  it("returns preview with relative change in display units", async () => {
    const result = await proposeChange(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "Car",
          key: "FrontRollBarStiffness",
          change: { mode: "relative", percent: 50 },
        },
      ],
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    // FrontRollBarStiffness has modifier 0.001 (kN/m)
    // Raw 12000 * 0.001 = 12 display, 12000 * 1.5 = 18000 raw → 18 display
    expect(data[0].before).toBe(12);
    expect(data[0].after).toBe(18);
  });

  it("clamps out-of-range values", async () => {
    const result = await proposeChange(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "Car",
          key: "MaxSteeringLock",
          change: { mode: "absolute", value: 1.5 },
        },
      ],
    });
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(data[0].after).toBe(0.9); // clamped to max
    expect(data[0].wasClamped).toBe(true);
  });

  it("includes mirrored R-side changes in preview", async () => {
    const result = await proposeChange(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "SpringDamperLB",
          key: "SpringStiffness",
          change: { mode: "absolute", value: 25 },
        },
      ],
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    // Should have 2 entries: LB + mirrored RB
    expect(data).toHaveLength(2);
    expect(data[0].section).toBe("SpringDamperLB");
    expect(data[1].section).toBe("SpringDamperRB");
    expect(data[1].after).toBe(data[0].after);
    expect(data[1].mirrored).toBe(true);
  });

  it("does not mirror non-mirrored sections like Car or Drive", async () => {
    const result = await proposeChange(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 0.8 } },
      ],
    });
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(data).toHaveLength(1);
    expect(data[0].section).toBe("Car");
  });

  it("rejects R-side sections", async () => {
    const result = await proposeChange(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "SpringDamperRF",
          key: "SpringStiffness",
          change: { mode: "absolute", value: 40000 },
        },
      ],
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("right-side section");
    expect(text).toContain("SpringDamperFront");
  });
});

describe("applyChanges", () => {
  it("creates mcp-managed file in SavedGames when source is not mcp-managed", async () => {
    const result = await applyChanges(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 0.8 } },
      ],
      targetFile: "tuned_gravel.lsp",
      base: "d_gravel.lsp",
      meta: { purpose: "test" },
    });
    expect(result.isError).toBeFalsy();

    // Verify file was written
    const writtenPath = join(TEST_DIR, "SavedGames", CAR_DIR, "tuned_gravel.lsp");
    const content = readFileSync(writtenPath, "utf-8");

    // LSP file should NOT contain comment header
    expect(content).not.toContain("; mcp-managed");
    // Verify LSP content is valid (contains CarSetup)
    expect(content).toContain("CarSetup");

    // Verify sidecar file was written
    expect(await isMcpManaged(writtenPath)).toBe(true);
    const sidecar = await readMcpSidecar(writtenPath);
    expect(sidecar?.base).toBe("d_gravel.lsp");
    expect(sidecar?.meta).toEqual({ purpose: "test" });
  });

  it("overwrites mcp-managed file in place", async () => {
    // First create an mcp-managed file
    const firstResult = await applyChanges(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 0.8 } },
      ],
      targetFile: "overwrite_test.lsp",
    });
    expect(firstResult.isError).toBeFalsy();

    // Re-scan to pick up the new file
    const root = new NodeDirectoryHandle(TEST_DIR);
    ctx.carGroups = await scanRbrDirectory(root);

    // Now modify the mcp-managed file
    const secondResult = await applyChanges(ctx, {
      car: "TestCar",
      file: "overwrite_test.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 0.85 } },
      ],
    });
    expect(secondResult.isError).toBeFalsy();

    // Verify it was overwritten (not a new file)
    const text = (secondResult.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("overwrite_test.lsp");
  });

  it("mirrors L-side edits to R-side sections in output", async () => {
    const result = await applyChanges(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "SpringDamperLB",
          key: "SpringStiffness",
          change: { mode: "absolute", value: 25 },
        },
        { section: "TyreLF", key: "Pressure", change: { mode: "absolute", value: 200 } },
      ],
      targetFile: "symmetric_test.lsp",
    });
    expect(result.isError).toBeFalsy();

    const writtenPath = join(TEST_DIR, "SavedGames", CAR_DIR, "symmetric_test.lsp");
    const content = readFileSync(writtenPath, "utf-8");

    // LB should have new value: 25 kN/m display → 25000 raw
    expect(content).toMatch(/SpringDamperLB[\s\S]*?SpringStiffness\s+25000/);
    // RB must match LB (symmetric!)
    expect(content).toMatch(/SpringDamperRB[\s\S]*?SpringStiffness\s+25000/);

    // TyreLF: 200 kPa display → 200000 raw
    expect(content).toMatch(/TyreLF[\s\S]*?Pressure\s+200000/);
    // TyreRF must match TyreLF
    expect(content).toMatch(/TyreRF[\s\S]*?Pressure\s+200000/);

    // TyreLB should be unchanged (220000) — only TyreLF was modified
    expect(content).toMatch(/TyreLB[\s\S]*?Pressure\s+220000/);
    // TyreRB must match TyreLB
    expect(content).toMatch(/TyreRB[\s\S]*?Pressure\s+220000/);
  });

  it("preserves R-side vecTopMountPosition signs when mirroring edits", async () => {
    const result = await applyChanges(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "SpringDamperLB",
          key: "SpringStiffness",
          change: { mode: "absolute", value: 25 },
        },
      ],
      targetFile: "vec_test.lsp",
    });
    expect(result.isError).toBeFalsy();

    const writtenPath = join(TEST_DIR, "SavedGames", CAR_DIR, "vec_test.lsp");
    const content = readFileSync(writtenPath, "utf-8");

    // WheelRF must keep its negative X (mirrored from LF's positive)
    expect(content).toMatch(/WheelRF[\s\S]*?vecTopMountPosition\s+-0\.526/);
    // WheelRB must keep its negative X
    expect(content).toMatch(/WheelRB[\s\S]*?vecTopMountPosition\s+-0\.500/);
  });

  it("preserves original R-side values for non-edited keys", async () => {
    const result = await applyChanges(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "SpringDamperLF",
          key: "SpringStiffness",
          change: { mode: "absolute", value: 40 },
        },
      ],
      targetFile: "preserve_rf_test.lsp",
    });
    expect(result.isError).toBeFalsy();

    const writtenPath = join(TEST_DIR, "SavedGames", CAR_DIR, "preserve_rf_test.lsp");
    const content = readFileSync(writtenPath, "utf-8");

    // RF SpringStiffness should be mirrored from edited LF: 40 kN/m → 40000 raw
    expect(content).toMatch(/SpringDamperRF[\s\S]*?SpringStiffness\s+40000/);
    // RF DampingBump should keep its ORIGINAL value (4800), not LF's (4950)
    expect(content).toMatch(/SpringDamperRF[\s\S]*?DampingBump\s+4800/);
  });

  it("accepts sanitized section names (e.g. SpringDamperBack)", async () => {
    const result = await proposeChange(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        {
          section: "SpringDamperBack",
          key: "SpringStiffness",
          change: { mode: "absolute", value: 25 },
        },
      ],
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(data[0].key).toBe("SpringStiffness");
  });

  it("accepts sanitized section names in apply_changes", async () => {
    const result = await applyChanges(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "TyreFront", key: "Pressure", change: { mode: "absolute", value: 200 } },
      ],
      targetFile: "sanitized_name_test.lsp",
    });
    expect(result.isError).toBeFalsy();
  });

  it("refuses to overwrite non-mcp-managed source without targetFile", async () => {
    const result = await applyChanges(ctx, {
      car: "TestCar",
      file: "d_gravel.lsp",
      surface: "gravel",
      changes: [
        { section: "Car", key: "MaxSteeringLock", change: { mode: "absolute", value: 0.8 } },
      ],
    });
    // Should auto-generate filename, not overwrite
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("_mcp.lsp");
  });
});
