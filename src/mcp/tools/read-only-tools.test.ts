import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanRbrDirectory } from "../../lib/rbr-scanner.ts";
import type { McpContext } from "../context.ts";
import { NodeDirectoryHandle } from "../node-fs-adapter.ts";
import { compareSetups } from "./compare-setups.ts";
import { listCars } from "./list-cars.ts";
import { readRanges } from "./read-ranges.ts";
import { readSetup } from "./read-setup.ts";

const TEST_DIR = join(tmpdir(), "rbr-mcp-tools-test");
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
))`;

const SETUP_CONTENT_2 = `(("CarSetup"
  Car
  ("Car"
   MaxSteeringLock 0.85
   FrontRollBarStiffness 14000
   RearRollBarStiffness 9000
   )
  Drive
  (":-D"
   FinalDriveRatio 4.8
   )
  Engine
  (":-D"
   Features_NGP 0
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
   )
))`;

let ctx: McpContext;

beforeAll(async () => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  // Create RBR directory structure
  const setupsDir = join(TEST_DIR, "rsfdata", "cars", CAR_DIR, "setups");
  mkdirSync(setupsDir, { recursive: true });
  writeFileSync(join(setupsDir, "d_gravel.lsp"), SETUP_CONTENT);
  writeFileSync(join(setupsDir, "d_tarmac.lsp"), SETUP_CONTENT_2);

  // Range file goes in the car directory root
  writeFileSync(join(TEST_DIR, "rsfdata", "cars", CAR_DIR, "r_gravel.lsp"), RANGE_CONTENT);

  const root = new NodeDirectoryHandle(TEST_DIR);
  const carGroups = await scanRbrDirectory(root);

  ctx = {
    projectRoot: TEST_DIR,
    rbrDir: TEST_DIR,
    carGroups,
  };
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("listCars", () => {
  it("returns car groups with setup info", async () => {
    const result = await listCars(ctx);
    expect(result.isError).toBeFalsy();
    const text = result.content[0];
    expect(text.type).toBe("text");
    const data = JSON.parse((text as { type: "text"; text: string }).text);
    expect(data).toHaveLength(1);
    expect(data[0].carName).toBe("TestCar");
    expect(data[0].summary).toBeNull();
    expect(data[0].setups).toHaveLength(2);
    expect(data[0].surfaces).toContain("gravel");
  });
});

describe("readSetup", () => {
  it("returns parsed and sanitized setup", async () => {
    const result = await readSetup(ctx, { car: "TestCar", file: "d_gravel.lsp" });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(data.name).toContain("d_gravel.lsp");
    expect(data.car).toBeNull();
    // Should have sections
    expect(Object.keys(data.sections).length).toBeGreaterThan(0);
    // Car section should have MaxSteeringLock
    const carSection = data.sections.Car;
    expect(carSection).toBeDefined();
    expect(carSection.values.MaxSteeringLock).toBeDefined();
  });

  it("returns error for non-existent car", async () => {
    const result = await readSetup(ctx, { car: "NoCar", file: "d_gravel.lsp" });
    expect(result.isError).toBe(true);
  });

  it("returns error for non-existent file", async () => {
    const result = await readSetup(ctx, { car: "TestCar", file: "nope.lsp" });
    expect(result.isError).toBe(true);
  });
});

describe("readRanges", () => {
  it("returns range data for car and surface", async () => {
    const result = await readRanges(ctx, { car: "TestCar", surface: "gravel" });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    // Should have at least one section with ranges
    expect(Object.keys(data).length).toBeGreaterThan(0);
  });

  it("returns error for non-existent car", async () => {
    const result = await readRanges(ctx, { car: "NoCar", surface: "gravel" });
    expect(result.isError).toBe(true);
  });
});

describe("compareSetups", () => {
  it("returns comparison of two setups", async () => {
    const result = await compareSetups(ctx, {
      car: "TestCar",
      files: ["d_gravel.lsp", "d_tarmac.lsp"],
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(data.car).toBeNull();
    // Should have section comparisons
    expect(data.sections.length).toBeGreaterThan(0);
    // Should have rows with differences
    const hasRows = data.sections.some((section: { rows: unknown[] }) => section.rows.length > 0);
    expect(hasRows).toBe(true);
  });

  it("returns error for non-existent file", async () => {
    const result = await compareSetups(ctx, {
      car: "TestCar",
      files: ["d_gravel.lsp", "nope.lsp"],
    });
    expect(result.isError).toBe(true);
  });
});
