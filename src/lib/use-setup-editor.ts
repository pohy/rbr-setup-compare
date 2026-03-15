import { useCallback, useMemo } from "react";
import { deserializeEditState, serializeEditState } from "./edit-state-serialization.ts";
import type { CarSetup } from "./lsp-parser.ts";
import type { RangeTriplet } from "./range-parser.ts";
import { usePersistentState } from "./use-persistent-state.ts";

export type DiffMode = "vs-reference" | "vs-original";

export type EditState = {
  sourceName: string;
  sourceSetup: CarSetup;
  edits: Map<string, Map<string, number | string>>;
  diffMode: DiffMode;
};

function deepCloneSetup(setup: CarSetup): CarSetup {
  const sections: CarSetup["sections"] = {};
  for (const [name, section] of Object.entries(setup.sections)) {
    sections[name] = {
      id: section.id,
      values: { ...section.values },
      ...(section.rawValues ? { rawValues: { ...section.rawValues } } : {}),
    };
  }
  return { name: setup.name, sections };
}

export function deriveEditedSetup(
  sourceSetup: CarSetup,
  edits: Map<string, Map<string, number | string>>,
): CarSetup {
  const clone = deepCloneSetup(sourceSetup);

  for (const [section, keyEdits] of edits) {
    const sec = clone.sections[section];
    if (!sec) continue;
    for (const [key, value] of keyEdits) {
      sec.values[key] = value;
      // Clear rawValues for edited keys so setupToLsp uses the new value
      if (sec.rawValues) {
        delete sec.rawValues[key];
      }
    }
  }

  return clone;
}

export function clampToRange(value: number, range: RangeTriplet): number {
  const clamped = Math.min(Math.max(value, range.min), range.max);
  if (range.step === 0) return clamped;
  return range.min + Math.round((clamped - range.min) / range.step) * range.step;
}

export function stepValue(
  current: number,
  direction: 1 | -1,
  range: RangeTriplet,
  fine: boolean,
): number {
  const delta = fine ? range.step / 10 : range.step;
  const fineRange = fine ? { ...range, step: delta } : range;
  return clampToRange(current + direction * delta, fineRange);
}

export function useSetupEditor() {
  const persistOptions = useMemo(
    () => ({ serialize: serializeEditState, deserialize: deserializeEditState }),
    [],
  );
  const [editState, setEditState] = usePersistentState("rbr-edit-state", null, persistOptions);

  const startEdit = useCallback(
    (setup: CarSetup) => {
      setEditState({
        sourceName: setup.name,
        sourceSetup: deepCloneSetup(setup),
        edits: new Map(),
        diffMode: "vs-original",
      });
    },
    [setEditState],
  );

  const updateValue = useCallback(
    (section: string, key: string, rawValue: number | string) => {
      setEditState((prev) => {
        if (!prev) return prev;
        const newEdits = new Map(prev.edits);
        const sectionEdits = new Map(newEdits.get(section) ?? []);
        sectionEdits.set(key, rawValue);
        newEdits.set(section, sectionEdits);
        return { ...prev, edits: newEdits };
      });
    },
    [setEditState],
  );

  const updateValueWith = useCallback(
    (section: string, key: string, fn: (current: number) => number) => {
      setEditState((prev) => {
        if (!prev) return prev;
        // Read current value: from edits first, then from source setup
        const existing = prev.edits.get(section)?.get(key);
        const source = prev.sourceSetup.sections[section]?.values[key];
        const current = existing !== undefined ? Number(existing) : Number(source);
        if (Number.isNaN(current)) return prev;

        const newValue = fn(current);
        const newEdits = new Map(prev.edits);
        const sectionEdits = new Map(newEdits.get(section) ?? []);
        sectionEdits.set(key, newValue);
        newEdits.set(section, sectionEdits);
        return { ...prev, edits: newEdits };
      });
    },
    [setEditState],
  );

  const setDiffMode = useCallback(
    (mode: DiffMode) => {
      setEditState((prev) => (prev ? { ...prev, diffMode: mode } : prev));
    },
    [setEditState],
  );

  const resetValue = useCallback(
    (section: string, key: string) => {
      setEditState((prev) => {
        if (!prev) return prev;
        const sectionEdits = prev.edits.get(section);
        if (!sectionEdits?.has(key)) return prev;
        const newEdits = new Map(prev.edits);
        const newSectionEdits = new Map(sectionEdits);
        newSectionEdits.delete(key);
        if (newSectionEdits.size === 0) {
          newEdits.delete(section);
        } else {
          newEdits.set(section, newSectionEdits);
        }
        return { ...prev, edits: newEdits };
      });
    },
    [setEditState],
  );

  const discardEdit = useCallback(() => {
    setEditState(null);
  }, [setEditState]);

  const getEditedSetup = useCallback((): CarSetup | null => {
    if (!editState) return null;
    return deriveEditedSetup(editState.sourceSetup, editState.edits);
  }, [editState]);

  return {
    editState,
    startEdit,
    updateValue,
    updateValueWith,
    resetValue,
    setDiffMode,
    discardEdit,
    getEditedSetup,
  };
}
