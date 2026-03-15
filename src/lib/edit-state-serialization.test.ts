// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { deserializeEditState, serializeEditState } from "./edit-state-serialization.ts";
import type { EditState } from "./use-setup-editor.ts";

describe("serializeEditState", () => {
  it("serializes null to null", () => {
    expect(serializeEditState(null)).toBeNull();
  });

  it("serializes state with empty edits", () => {
    const state: EditState = {
      sourceName: "test.lsp",
      sourceSetup: {
        name: "test.lsp",
        sections: { Engine: { id: "1", values: { power: 50 } } },
      },
      edits: new Map(),
      diffMode: "vs-original",
    };
    const result = serializeEditState(state) as Record<string, unknown>;
    expect(result.sourceName).toBe("test.lsp");
    expect(result.edits).toEqual({});
    expect(result.diffMode).toBe("vs-original");
    expect(result.sourceSetup).toEqual(state.sourceSetup);
  });

  it("serializes state with populated edits (Map → Record)", () => {
    const innerEdits = new Map<string, number | string>([
      ["power", 75],
      ["turbo", "on"],
    ]);
    const state: EditState = {
      sourceName: "car.lsp",
      sourceSetup: {
        name: "car.lsp",
        sections: { Engine: { id: "1", values: { power: 50, turbo: "off" } } },
      },
      edits: new Map([["Engine", innerEdits]]),
      diffMode: "vs-reference",
    };
    const result = serializeEditState(state) as Record<string, unknown>;
    expect(result.edits).toEqual({ Engine: { power: 75, turbo: "on" } });
  });
});

describe("deserializeEditState", () => {
  it("round-trips: deserialize(serialize(state)) deep-equals original", () => {
    const innerEdits = new Map<string, number | string>([
      ["power", 75],
      ["label", "fast"],
    ]);
    const state: EditState = {
      sourceName: "car.lsp",
      sourceSetup: {
        name: "car.lsp",
        sections: {
          Engine: { id: "1", values: { power: 50, label: "slow" } },
          Gearbox: { id: "2", values: { ratio: 3.5 }, rawValues: { ratio: "3.5" } },
        },
      },
      edits: new Map([["Engine", innerEdits]]),
      diffMode: "vs-reference",
    };

    const roundTripped = deserializeEditState(serializeEditState(state));
    if (!roundTripped) {
      expect.unreachable("roundTripped should not be null");
      return;
    }
    expect(roundTripped.sourceName).toBe(state.sourceName);
    expect(roundTripped.sourceSetup).toEqual(state.sourceSetup);
    expect(roundTripped.diffMode).toBe(state.diffMode);
    // Compare Maps via entries
    expect([...roundTripped.edits.entries()]).toEqual([...state.edits.entries()]);
    for (const [section, keyEdits] of roundTripped.edits) {
      const original = state.edits.get(section);
      if (!original) {
        expect.unreachable(`section ${section} should exist in original`);
        return;
      }
      expect([...keyEdits.entries()]).toEqual([...original.entries()]);
    }
  });

  it("deserializes null to null", () => {
    expect(deserializeEditState(null)).toBeNull();
  });

  it("returns null for corrupted data (not an object)", () => {
    expect(deserializeEditState("garbage")).toBeNull();
    expect(deserializeEditState(42)).toBeNull();
    expect(deserializeEditState([])).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(deserializeEditState({ sourceName: "x" })).toBeNull();
    expect(deserializeEditState({ sourceName: "x", sourceSetup: {} })).toBeNull();
  });

  it("defaults diffMode to vs-original on invalid value", () => {
    const serialized = {
      sourceName: "test.lsp",
      sourceSetup: {
        name: "test.lsp",
        sections: { Engine: { id: "1", values: { power: 50 } } },
      },
      edits: {},
      diffMode: "invalid-mode",
    };
    const result = deserializeEditState(serialized);
    expect(result).not.toBeNull();
    expect(result?.diffMode).toBe("vs-original");
  });
});
