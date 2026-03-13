import { describe, expect, it } from "vitest";
import type { CarSetup } from "./lsp-parser.ts";
import { deriveEditedSetup } from "./use-setup-editor.ts";

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
