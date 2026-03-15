import type { DiffMode, EditState } from "./use-setup-editor.ts";

const VALID_DIFF_MODES: DiffMode[] = ["vs-reference", "vs-original"];

export function serializeEditState(state: EditState | null): unknown {
  if (state === null) return null;

  const edits: Record<string, Record<string, number | string>> = {};
  for (const [section, keyEdits] of state.edits) {
    edits[section] = Object.fromEntries(keyEdits);
  }

  return {
    sourceName: state.sourceName,
    sourceSetup: state.sourceSetup,
    edits,
    diffMode: state.diffMode,
  };
}

export function deserializeEditState(raw: unknown): EditState | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;

  if (typeof obj.sourceName !== "string") return null;
  if (!obj.sourceSetup || typeof obj.sourceSetup !== "object") return null;
  if (!obj.edits || typeof obj.edits !== "object") return null;

  // Validate sourceSetup has required shape
  const setup = obj.sourceSetup as Record<string, unknown>;
  if (typeof setup.name !== "string" || !setup.sections || typeof setup.sections !== "object") {
    return null;
  }

  // Convert edits Record → Map
  const editsRecord = obj.edits as Record<string, Record<string, number | string>>;
  const edits = new Map<string, Map<string, number | string>>();
  for (const [section, keyEdits] of Object.entries(editsRecord)) {
    edits.set(section, new Map(Object.entries(keyEdits)));
  }

  const diffMode: DiffMode = VALID_DIFF_MODES.includes(obj.diffMode as DiffMode)
    ? (obj.diffMode as DiffMode)
    : "vs-original";

  return {
    sourceName: obj.sourceName as string,
    sourceSetup: obj.sourceSetup as EditState["sourceSetup"],
    edits,
    diffMode,
  };
}
