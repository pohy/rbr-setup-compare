import { describe, expect, it } from "vitest";
import {
  createManualEntry,
  type ManualSetupEntry,
  rehydrateSetups,
  removeEntry,
  restoreManualSetups,
} from "./manual-setup-store.ts";

const SAMPLE_LSP = `(("CarSetup"
  Car
  ("Car"
   MaxSteeringLock 0.75
   FrontRollBarStiffness 20000
  )
))`;

describe("createManualEntry", () => {
  it("creates entry with name and text", () => {
    const entry = createManualEntry("setup.lsp", SAMPLE_LSP);
    expect(entry.name).toBe("setup.lsp");
    expect(entry.text).toBe(SAMPLE_LSP);
  });

  it("assigns a unique id (UUID format)", () => {
    const a = createManualEntry("a.lsp", SAMPLE_LSP);
    const b = createManualEntry("b.lsp", SAMPLE_LSP);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
  });

  it("generates unique IDs for duplicate names", () => {
    const a = createManualEntry("same.lsp", SAMPLE_LSP);
    const b = createManualEntry("same.lsp", SAMPLE_LSP);
    expect(a.id).not.toBe(b.id);
  });
});

describe("rehydrateSetups", () => {
  it("parses stored entries back to CarSetup objects with manualId", () => {
    const entries: ManualSetupEntry[] = [{ id: "abc-123", name: "setup.lsp", text: SAMPLE_LSP }];

    const setups = rehydrateSetups(entries);

    expect(setups).toHaveLength(1);
    expect(setups[0].manualId).toBe("abc-123");
    expect(setups[0].name).toBe("setup.lsp");
    expect(setups[0].sections.Car.values.MaxSteeringLock).toBe(0.75);
  });

  it("returns empty array for empty entries", () => {
    expect(rehydrateSetups([])).toEqual([]);
  });

  it("skips entries that fail to parse", () => {
    const entries: ManualSetupEntry[] = [
      { id: "good", name: "good.lsp", text: SAMPLE_LSP },
      { id: "bad", name: "bad.lsp", text: "not valid lsp content (((" },
    ];

    const setups = rehydrateSetups(entries);

    // Should get at least the good one; bad one silently skipped
    expect(setups.some((s) => s.manualId === "good")).toBe(true);
    expect(setups.some((s) => s.manualId === "bad")).toBe(false);
  });

  it("preserves multiple entries with same name (duplicates allowed)", () => {
    const entries: ManualSetupEntry[] = [
      { id: "id-1", name: "setup.lsp", text: SAMPLE_LSP },
      { id: "id-2", name: "setup.lsp", text: SAMPLE_LSP },
    ];

    const setups = rehydrateSetups(entries);

    expect(setups).toHaveLength(2);
    expect(setups[0].manualId).toBe("id-1");
    expect(setups[1].manualId).toBe("id-2");
  });
});

describe("removeEntry", () => {
  const entries: ManualSetupEntry[] = [
    { id: "a", name: "a.lsp", text: "a" },
    { id: "b", name: "b.lsp", text: "b" },
    { id: "c", name: "c.lsp", text: "c" },
  ];

  it("removes entry by ID", () => {
    const result = removeEntry(entries, "b");
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("returns unchanged array when ID not found", () => {
    const result = removeEntry(entries, "nonexistent");
    expect(result).toHaveLength(3);
  });

  it("does not mutate original array", () => {
    removeEntry(entries, "a");
    expect(entries).toHaveLength(3);
  });
});

describe("restoreManualSetups", () => {
  it("appends rehydrated setups via the setter callback", () => {
    const entries: ManualSetupEntry[] = [{ id: "x", name: "setup.lsp", text: SAMPLE_LSP }];
    const calls: unknown[] = [];
    const setter = (fn: (prev: never[]) => unknown) => {
      calls.push(fn([]));
    };

    restoreManualSetups(entries, setter as Parameters<typeof restoreManualSetups>[1]);

    expect(calls).toHaveLength(1);
    const result = calls[0] as Array<{ manualId: string }>;
    expect(result).toHaveLength(1);
    expect(result[0].manualId).toBe("x");
  });

  it("does nothing when entries are empty", () => {
    let called = false;
    const setter = () => {
      called = true;
    };

    restoreManualSetups([], setter as Parameters<typeof restoreManualSetups>[1]);

    expect(called).toBe(false);
  });

  it("skips unparseable entries without crashing", () => {
    const entries: ManualSetupEntry[] = [{ id: "bad", name: "bad.lsp", text: "garbage" }];
    let called = false;
    const setter = () => {
      called = true;
    };

    restoreManualSetups(entries, setter as Parameters<typeof restoreManualSetups>[1]);

    // No valid setups → setter not called
    expect(called).toBe(false);
  });
});
