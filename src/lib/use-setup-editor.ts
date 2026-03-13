import { useCallback, useState } from "react";
import type { CarSetup } from "./lsp-parser.ts";

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

export function useSetupEditor() {
  const [editState, setEditState] = useState<EditState | null>(null);

  const startEdit = useCallback((setup: CarSetup) => {
    setEditState({
      sourceName: setup.name,
      sourceSetup: deepCloneSetup(setup),
      edits: new Map(),
      diffMode: "vs-reference",
    });
  }, []);

  const updateValue = useCallback((section: string, key: string, rawValue: number | string) => {
    setEditState((prev) => {
      if (!prev) return prev;
      const newEdits = new Map(prev.edits);
      const sectionEdits = new Map(newEdits.get(section) ?? []);
      sectionEdits.set(key, rawValue);
      newEdits.set(section, sectionEdits);
      return { ...prev, edits: newEdits };
    });
  }, []);

  const setDiffMode = useCallback((mode: DiffMode) => {
    setEditState((prev) => (prev ? { ...prev, diffMode: mode } : prev));
  }, []);

  const discardEdit = useCallback(() => {
    setEditState(null);
  }, []);

  const getEditedSetup = useCallback((): CarSetup | null => {
    if (!editState) return null;
    return deriveEditedSetup(editState.sourceSetup, editState.edits);
  }, [editState]);

  return {
    editState,
    startEdit,
    updateValue,
    setDiffMode,
    discardEdit,
    getEditedSetup,
  };
}
