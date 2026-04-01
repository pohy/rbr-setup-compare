import { describe, expect, it } from "vitest";
import { hasLspChanges, processRecords, type WatcherChange } from "./watcher-records.ts";

function makeRecord(
  overrides: Partial<FileSystemChangeRecord> & { relativePathComponents: string[] },
): FileSystemChangeRecord {
  return {
    type: "appeared",
    relativePathComponents: overrides.relativePathComponents,
    relativePathMovedFrom: overrides.relativePathMovedFrom,
    changedHandle: null,
    root: {} as FileSystemDirectoryHandle,
    ...overrides,
  };
}

describe("processRecords", () => {
  it("joins relativePathComponents into relativePath", () => {
    const records = [
      makeRecord({
        type: "appeared",
        relativePathComponents: ["rsfdata", "cars", "BMW_M3_E30", "setups", "fast.lsp"],
      }),
    ];
    const result = processRecords(records);
    expect(result).toEqual([
      { type: "appeared", relativePath: "rsfdata/cars/BMW_M3_E30/setups/fast.lsp" },
    ]);
  });

  it("filters out non-.lsp files", () => {
    const records = [
      makeRecord({
        type: "appeared",
        relativePathComponents: ["rsfdata", "cars", "BMW", "setups", "readme.txt"],
      }),
      makeRecord({
        type: "modified",
        relativePathComponents: ["rsfdata", "cars", "BMW", "setups", "fast.lsp"],
      }),
      makeRecord({
        type: "appeared",
        relativePathComponents: ["rsfdata", "cars", "BMW", "physics.rbz"],
      }),
    ];
    const result = processRecords(records);
    expect(result).toEqual([
      { type: "modified", relativePath: "rsfdata/cars/BMW/setups/fast.lsp" },
    ]);
  });

  it("maps appeared/disappeared/modified types through unchanged", () => {
    const types = ["appeared", "disappeared", "modified"] as const;
    for (const type of types) {
      const records = [makeRecord({ type, relativePathComponents: ["setup.lsp"] })];
      const result = processRecords(records);
      expect(result[0].type).toBe(type);
    }
  });

  it("maps 'moved' to disappeared (old path) + appeared (new path)", () => {
    const records = [
      makeRecord({
        type: "moved",
        relativePathComponents: ["setups", "new_name.lsp"],
        relativePathMovedFrom: ["setups", "old_name.lsp"],
      }),
    ];
    const result = processRecords(records);
    expect(result).toContainEqual({
      type: "disappeared",
      relativePath: "setups/old_name.lsp",
    } satisfies WatcherChange);
    expect(result).toContainEqual({
      type: "appeared",
      relativePath: "setups/new_name.lsp",
    } satisfies WatcherChange);
  });

  it("deduplicates: multiple records for same path — last type wins", () => {
    const records = [
      makeRecord({ type: "appeared", relativePathComponents: ["setups", "a.lsp"] }),
      makeRecord({ type: "modified", relativePathComponents: ["setups", "a.lsp"] }),
    ];
    const result = processRecords(records);
    expect(result).toEqual([{ type: "modified", relativePath: "setups/a.lsp" }]);
  });

  it("ignores 'unknown' record type", () => {
    const records = [makeRecord({ type: "unknown", relativePathComponents: ["setups", "a.lsp"] })];
    const result = processRecords(records);
    expect(result).toEqual([]);
  });

  it("ignores 'errored' record type", () => {
    const records = [makeRecord({ type: "errored", relativePathComponents: ["setups", "a.lsp"] })];
    const result = processRecords(records);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty records", () => {
    expect(processRecords([])).toEqual([]);
  });

  it("throws on unhandled record type", () => {
    const records = [
      makeRecord({
        type: "brand_new_type" as FileSystemChangeRecord["type"],
        relativePathComponents: ["setups", "a.lsp"],
      }),
    ];
    expect(() => processRecords(records)).toThrow("brand_new_type");
  });

  it("handles moved record where only the new path is .lsp", () => {
    const records = [
      makeRecord({
        type: "moved",
        relativePathComponents: ["setups", "renamed.lsp"],
        relativePathMovedFrom: ["setups", "old_name.txt"],
      }),
    ];
    const result = processRecords(records);
    // New path is .lsp → appeared; old path is .txt → filtered out
    expect(result).toEqual([{ type: "appeared", relativePath: "setups/renamed.lsp" }]);
  });

  it("handles moved record where only the old path is .lsp", () => {
    const records = [
      makeRecord({
        type: "moved",
        relativePathComponents: ["setups", "renamed.txt"],
        relativePathMovedFrom: ["setups", "old_name.lsp"],
      }),
    ];
    const result = processRecords(records);
    // Old path is .lsp → disappeared; new path is .txt → filtered out
    expect(result).toEqual([{ type: "disappeared", relativePath: "setups/old_name.lsp" }]);
  });
});

describe("hasLspChanges", () => {
  it("returns true when .lsp changes exist", () => {
    const records = [
      makeRecord({ type: "modified", relativePathComponents: ["setups", "fast.lsp"] }),
    ];
    expect(hasLspChanges(records)).toBe(true);
  });

  it("returns false when no .lsp changes exist", () => {
    const records = [
      makeRecord({ type: "modified", relativePathComponents: ["readme.txt"] }),
      makeRecord({ type: "appeared", relativePathComponents: ["data.json"] }),
    ];
    expect(hasLspChanges(records)).toBe(false);
  });

  it("returns false for empty records", () => {
    expect(hasLspChanges([])).toBe(false);
  });

  it("returns false when only unknown/errored types for .lsp files", () => {
    const records = [
      makeRecord({ type: "unknown", relativePathComponents: ["setups", "a.lsp"] }),
      makeRecord({ type: "errored", relativePathComponents: ["setups", "b.lsp"] }),
    ];
    expect(hasLspChanges(records)).toBe(false);
  });

  it("throws on unhandled record type", () => {
    const records = [
      makeRecord({
        type: "brand_new_type" as FileSystemChangeRecord["type"],
        relativePathComponents: ["setups", "a.lsp"],
      }),
    ];
    expect(() => hasLspChanges(records)).toThrow("brand_new_type");
  });

  it("returns true for moved .lsp files", () => {
    const records = [
      makeRecord({
        type: "moved",
        relativePathComponents: ["setups", "new.lsp"],
        relativePathMovedFrom: ["setups", "old.lsp"],
      }),
    ];
    expect(hasLspChanges(records)).toBe(true);
  });
});
