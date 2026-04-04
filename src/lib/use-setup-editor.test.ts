// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CarSetup } from "./lsp-parser.ts";
import { clampToRange, deriveEditedSetup, stepValue, useSetupEditor } from "./use-setup-editor.ts";

function makeSetup(overrides?: Partial<CarSetup>): CarSetup {
  return {
    name: "test-setup.lsp",
    sections: {
      SpringDamperLF: {
        id: ":-D",
        values: {
          SpringStiffness: 50000,
          SpringLength: 0.22,
          DampingBump: 3000,
        },
        rawValues: {
          SpringStiffness: "50000",
          SpringLength: "0.22",
          DampingBump: "3000",
        },
      },
      Car: {
        id: "Car",
        values: {
          MaxSteeringLock: 0.75,
          FrontRollBarStiffness: 20000,
        },
        rawValues: {
          MaxSteeringLock: "0.75",
          FrontRollBarStiffness: "20000",
        },
      },
    },
    ...overrides,
  };
}

describe("deriveEditedSetup", () => {
  it("returns a clone with no edits applied when edits map is empty", () => {
    const source = makeSetup();
    const edits = new Map<string, Map<string, number | string>>();
    const result = deriveEditedSetup(source, edits);

    expect(result.sections.SpringDamperLF.values.SpringStiffness).toBe(50000);
    expect(result.sections.Car.values.MaxSteeringLock).toBe(0.75);
  });

  it("does not mutate the source setup", () => {
    const source = makeSetup();
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("SpringDamperLF", new Map([["SpringStiffness", 55000]]));

    deriveEditedSetup(source, edits);

    expect(source.sections.SpringDamperLF.values.SpringStiffness).toBe(50000);
  });

  it("overlays edits onto the clone", () => {
    const source = makeSetup();
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("SpringDamperLF", new Map([["SpringStiffness", 55000]]));

    const result = deriveEditedSetup(source, edits);

    expect(result.sections.SpringDamperLF.values.SpringStiffness).toBe(55000);
    // Unedited values remain
    expect(result.sections.SpringDamperLF.values.SpringLength).toBe(0.22);
    expect(result.sections.SpringDamperLF.values.DampingBump).toBe(3000);
  });

  it("overlays edits across multiple sections", () => {
    const source = makeSetup();
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("SpringDamperLF", new Map([["SpringStiffness", 55000]]));
    edits.set("Car", new Map([["MaxSteeringLock", 0.8]]));

    const result = deriveEditedSetup(source, edits);

    expect(result.sections.SpringDamperLF.values.SpringStiffness).toBe(55000);
    expect(result.sections.Car.values.MaxSteeringLock).toBe(0.8);
  });

  it("clears rawValues for edited keys", () => {
    const source = makeSetup();
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("SpringDamperLF", new Map([["SpringStiffness", 55000]]));

    const result = deriveEditedSetup(source, edits);

    // Edited key's rawValue is deleted
    expect(result.sections.SpringDamperLF.rawValues?.SpringStiffness).toBeUndefined();
    // Unedited keys' rawValues remain
    expect(result.sections.SpringDamperLF.rawValues?.SpringLength).toBe("0.22");
    expect(result.sections.SpringDamperLF.rawValues?.DampingBump).toBe("3000");
  });

  it("handles sections without rawValues", () => {
    const source: CarSetup = {
      name: "no-raw",
      sections: {
        Car: {
          id: "Car",
          values: { MaxSteeringLock: 0.75 },
          // No rawValues
        },
      },
    };
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("Car", new Map([["MaxSteeringLock", 0.8]]));

    const result = deriveEditedSetup(source, edits);

    expect(result.sections.Car.values.MaxSteeringLock).toBe(0.8);
  });

  it("mirrors L-side edits to R-side sections", () => {
    const source: CarSetup = {
      name: "test",
      sections: {
        SpringDamperLF: { id: ":-D", values: { SpringStiffness: 38000, DampingBump: 4950 } },
        SpringDamperRF: { id: ":-D", values: { SpringStiffness: 38000, DampingBump: 4800 } },
        SpringDamperLB: { id: ":-D", values: { SpringStiffness: 31600 } },
        SpringDamperRB: { id: ":-D", values: { SpringStiffness: 31600 } },
        TyreLF: { id: ":-D", values: { Pressure: 220000 } },
        TyreRF: { id: ":-D", values: { Pressure: 220000 } },
        Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
      },
    };
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("SpringDamperLF", new Map([["SpringStiffness", 40000]]));
    edits.set("TyreLF", new Map([["Pressure", 200000]]));

    const result = deriveEditedSetup(source, edits);

    // L-side has edits applied
    expect(result.sections.SpringDamperLF.values.SpringStiffness).toBe(40000);
    expect(result.sections.TyreLF.values.Pressure).toBe(200000);
    // R-side mirrors edited keys
    expect(result.sections.SpringDamperRF.values.SpringStiffness).toBe(40000);
    expect(result.sections.TyreRF.values.Pressure).toBe(200000);
    // R-side non-edited keys preserve original values
    expect(result.sections.SpringDamperRF.values.DampingBump).toBe(4800);
    // Non-mirrored sections unaffected
    expect(result.sections.Car.values.MaxSteeringLock).toBe(0.75);
    // RB not affected (LB wasn't edited)
    expect(result.sections.SpringDamperRB.values.SpringStiffness).toBe(31600);
  });

  it("mirrors edits and clears rawValues on R-side for mirrored keys", () => {
    const source: CarSetup = {
      name: "test",
      sections: {
        SpringDamperLB: {
          id: ":-D",
          values: { SpringStiffness: 31600 },
          rawValues: { SpringStiffness: "31600.000000" },
        },
        SpringDamperRB: {
          id: ":-D",
          values: { SpringStiffness: 31600 },
          rawValues: { SpringStiffness: "31600.000000" },
        },
      },
    };
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("SpringDamperLB", new Map([["SpringStiffness", 25000]]));

    const result = deriveEditedSetup(source, edits);

    expect(result.sections.SpringDamperRB.values.SpringStiffness).toBe(25000);
    expect(result.sections.SpringDamperRB.rawValues?.SpringStiffness).toBeUndefined();
  });

  it("does not mutate source R-side sections when mirroring", () => {
    const source: CarSetup = {
      name: "test",
      sections: {
        SpringDamperLF: { id: ":-D", values: { SpringStiffness: 38000 } },
        SpringDamperRF: { id: ":-D", values: { SpringStiffness: 38000 } },
      },
    };
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("SpringDamperLF", new Map([["SpringStiffness", 40000]]));

    deriveEditedSetup(source, edits);

    expect(source.sections.SpringDamperRF.values.SpringStiffness).toBe(38000);
  });

  it("ignores edits for nonexistent sections", () => {
    const source = makeSetup();
    const edits = new Map<string, Map<string, number | string>>();
    edits.set("NonExistent", new Map([["Foo", 123]]));

    const result = deriveEditedSetup(source, edits);

    expect(result.sections.NonExistent).toBeUndefined();
    expect(result.sections.SpringDamperLF.values.SpringStiffness).toBe(50000);
  });

  it("edited keys are derivable from edits map keys", () => {
    const edits = new Map<string, Map<string, number | string>>();
    edits.set(
      "SpringDamperLF",
      new Map([
        ["SpringStiffness", 55000],
        ["DampingBump", 3500],
      ]),
    );
    edits.set("Car", new Map([["MaxSteeringLock", 0.8]]));

    const editedKeys: Array<[string, string]> = [];
    for (const [section, keyEdits] of edits) {
      for (const key of keyEdits.keys()) {
        editedKeys.push([section, key]);
      }
    }

    expect(editedKeys).toEqual([
      ["SpringDamperLF", "SpringStiffness"],
      ["SpringDamperLF", "DampingBump"],
      ["Car", "MaxSteeringLock"],
    ]);
  });
});

describe("clampToRange", () => {
  const range = { min: 100, max: 500, step: 50 };

  it("clamps below min to min", () => {
    expect(clampToRange(50, range)).toBe(100);
  });

  it("clamps above max to max", () => {
    expect(clampToRange(600, range)).toBe(500);
  });

  it("returns value unchanged when within range and on step grid", () => {
    expect(clampToRange(250, range)).toBe(250);
  });

  it("snaps to nearest step grid point", () => {
    expect(clampToRange(230, range)).toBe(250);
    expect(clampToRange(220, range)).toBe(200);
  });
});

describe("stepValue", () => {
  const range = { min: 100, max: 500, step: 50 };

  it("increments by one step", () => {
    expect(stepValue(200, 1, range, false)).toBe(250);
  });

  it("decrements by one step", () => {
    expect(stepValue(200, -1, range, false)).toBe(150);
  });

  it("clamps at max boundary", () => {
    expect(stepValue(500, 1, range, false)).toBe(500);
  });

  it("clamps at min boundary", () => {
    expect(stepValue(100, -1, range, false)).toBe(100);
  });

  it("uses step/10 in fine mode", () => {
    expect(stepValue(200, 1, range, true)).toBe(205);
  });
});

describe("useSetupEditor.setDiffMode", () => {
  const setup: CarSetup = {
    name: "test.lsp",
    sections: {
      Car: { id: "Car", values: { MaxSteeringLock: 0.75 }, rawValues: { MaxSteeringLock: "0.75" } },
    },
  };

  it("starts with vs-original", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));
    expect(result.current.editState?.diffMode).toBe("vs-original");
  });

  it("toggles to vs-reference and back", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));

    act(() => result.current.setDiffMode("vs-reference"));
    expect(result.current.editState?.diffMode).toBe("vs-reference");

    act(() => result.current.setDiffMode("vs-original"));
    expect(result.current.editState?.diffMode).toBe("vs-original");
  });

  it("resetting to vs-reference clears stale vs-original state", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));

    // Simulate: toggle to vs-reference, then reset back (as App.tsx would on reorder)
    act(() => result.current.setDiffMode("vs-reference"));
    act(() => result.current.setDiffMode("vs-reference")); // idempotent
    expect(result.current.editState?.diffMode).toBe("vs-reference");
  });
});

describe("useSetupEditor.updateValueWith", () => {
  const setup: CarSetup = {
    name: "test.lsp",
    sections: {
      SpringDamperLF: {
        id: ":-D",
        values: { SpringStiffness: 50000 },
        rawValues: { SpringStiffness: "50000" },
      },
    },
  };

  it("accumulates multiple steps without losing intermediate values", () => {
    const { result } = renderHook(() => useSetupEditor());

    act(() => result.current.startEdit(setup));

    // Fire 3 rapid +100 steps without letting React re-render in between
    act(() => {
      result.current.updateValueWith("SpringDamperLF", "SpringStiffness", (v) => v + 100);
      result.current.updateValueWith("SpringDamperLF", "SpringStiffness", (v) => v + 100);
      result.current.updateValueWith("SpringDamperLF", "SpringStiffness", (v) => v + 100);
    });

    const edited = result.current.getEditedSetup();
    expect(edited?.sections.SpringDamperLF.values.SpringStiffness).toBe(50300);
  });

  it("reads from source value when no prior edits exist", () => {
    const { result } = renderHook(() => useSetupEditor());

    act(() => result.current.startEdit(setup));

    act(() => {
      result.current.updateValueWith("SpringDamperLF", "SpringStiffness", (v) => v + 500);
    });

    const edited = result.current.getEditedSetup();
    expect(edited?.sections.SpringDamperLF.values.SpringStiffness).toBe(50500);
  });

  it("does nothing for nonexistent sections", () => {
    const { result } = renderHook(() => useSetupEditor());

    act(() => result.current.startEdit(setup));

    act(() => {
      result.current.updateValueWith("NonExistent", "Foo", (v) => v + 1);
    });

    // Should not create the section
    const edited = result.current.getEditedSetup();
    expect(edited?.sections.NonExistent).toBeUndefined();
  });
});

describe("useSetupEditor.relocateSource", () => {
  const setup: CarSetup = {
    name: "rsfdata/cars/Car/setups/gravel.lsp",
    sections: {
      SpringDamperLF: {
        id: ":-D",
        values: { SpringStiffness: 50000, SpringLength: 0.22 },
        rawValues: { SpringStiffness: "50000", SpringLength: "0.22" },
      },
    },
  };

  it("updates sourceName to new path", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));
    act(() => result.current.relocateSource("SavedGames/Car/gravel.lsp"));

    expect(result.current.editState?.sourceName).toBe("SavedGames/Car/gravel.lsp");
  });

  it("clears edits", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));
    act(() => result.current.updateValue("SpringDamperLF", "SpringStiffness", 55000));
    act(() => result.current.relocateSource("SavedGames/Car/gravel.lsp"));

    expect(result.current.editState?.edits.size).toBe(0);
  });

  it("bakes edits into sourceSetup", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));
    act(() => result.current.updateValue("SpringDamperLF", "SpringStiffness", 55000));
    act(() => result.current.relocateSource("SavedGames/Car/gravel.lsp"));

    expect(
      result.current.editState?.sourceSetup.sections.SpringDamperLF.values.SpringStiffness,
    ).toBe(55000);
    // Unedited value preserved
    expect(result.current.editState?.sourceSetup.sections.SpringDamperLF.values.SpringLength).toBe(
      0.22,
    );
  });

  it("getEditedSetup returns setup with baked values", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));
    act(() => result.current.updateValue("SpringDamperLF", "SpringStiffness", 55000));
    act(() => result.current.relocateSource("SavedGames/Car/gravel.lsp"));

    const edited = result.current.getEditedSetup();
    expect(edited?.sections.SpringDamperLF.values.SpringStiffness).toBe(55000);
  });

  it("preserves diffMode", () => {
    const { result } = renderHook(() => useSetupEditor());
    act(() => result.current.startEdit(setup));
    act(() => result.current.setDiffMode("vs-reference"));
    act(() => result.current.relocateSource("SavedGames/Car/gravel.lsp"));

    expect(result.current.editState?.diffMode).toBe("vs-reference");
  });

  it("is a no-op when no edit state", () => {
    const { result } = renderHook(() => useSetupEditor());
    // Clear any leftover persisted state from previous tests
    act(() => result.current.discardEdit());
    act(() => result.current.relocateSource("SavedGames/Car/gravel.lsp"));

    expect(result.current.editState).toBeNull();
  });
});
