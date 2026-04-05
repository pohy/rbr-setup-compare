import { useCallback, useMemo } from "react";
import { deserializeEditState, serializeEditState } from "./edit-state-serialization.ts";
import type { CarSetup } from "./lsp-parser.ts";
import { clampToRange, deepCloneSetup, deriveEditedSetup, stepValue } from "./setup-edits.ts";
import { usePersistentState } from "./use-persistent-state.ts";

export { clampToRange, deriveEditedSetup, stepValue };

export type DiffMode = "vs-reference" | "vs-original";

export type EditState = {
  sourceName: string;
  sourceSetup: CarSetup;
  edits: Map<string, Map<string, number | string>>;
  diffMode: DiffMode;
};

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
        if (!prev) {
          return prev;
        }
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
        if (!prev) {
          return prev;
        }
        // Read current value: from edits first, then from source setup
        const existing = prev.edits.get(section)?.get(key);
        const source = prev.sourceSetup.sections[section]?.values[key];
        const current = existing !== undefined ? Number(existing) : Number(source);
        if (Number.isNaN(current)) {
          return prev;
        }

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
        if (!prev) {
          return prev;
        }
        const sectionEdits = prev.edits.get(section);
        if (!sectionEdits?.has(key)) {
          return prev;
        }
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

  const updateSource = useCallback(
    (newSetup: CarSetup) => {
      setEditState((prev) => {
        if (!prev || prev.sourceName !== newSetup.name) {
          return prev;
        }
        return { ...prev, sourceSetup: deepCloneSetup(newSetup) };
      });
    },
    [setEditState],
  );

  const relocateSource = useCallback(
    (newName: string) => {
      setEditState((prev) => {
        if (!prev) {
          return prev;
        }
        const baked = deriveEditedSetup(prev.sourceSetup, prev.edits);
        return {
          sourceName: newName,
          sourceSetup: baked,
          edits: new Map(),
          diffMode: prev.diffMode,
        };
      });
    },
    [setEditState],
  );

  const discardEdit = useCallback(() => {
    setEditState(null);
  }, [setEditState]);

  const getEditedSetup = useCallback((): CarSetup | null => {
    if (!editState) {
      return null;
    }
    return deriveEditedSetup(editState.sourceSetup, editState.edits);
  }, [editState]);

  return {
    editState,
    startEdit,
    updateValue,
    updateValueWith,
    updateSource,
    relocateSource,
    resetValue,
    setDiffMode,
    discardEdit,
    getEditedSetup,
  };
}
