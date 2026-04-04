import type { CarSetup } from "./lsp-parser.ts";
import type { RangeTriplet } from "./range-parser.ts";
import { SECTION_MIRRORS } from "./sanitize.ts";

export function deepCloneSetup(setup: CarSetup): CarSetup {
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

function applyEditsToSection(
  setup: CarSetup,
  section: string,
  keyEdits: Map<string, number | string>,
): void {
  const sec = setup.sections[section];
  if (!sec) {
    return;
  }
  for (const [key, value] of keyEdits) {
    sec.values[key] = value;
    if (sec.rawValues) {
      delete sec.rawValues[key];
    }
  }
}

export function deriveEditedSetup(
  sourceSetup: CarSetup,
  edits: Map<string, Map<string, number | string>>,
): CarSetup {
  const clone = deepCloneSetup(sourceSetup);

  for (const [section, keyEdits] of edits) {
    applyEditsToSection(clone, section, keyEdits);

    // Mirror edited keys to the R-side section if one exists
    const mirror = SECTION_MIRRORS[section];
    if (mirror) {
      applyEditsToSection(clone, mirror, keyEdits);
    }
  }

  return clone;
}

export function clampToRange(value: number, range: RangeTriplet): number {
  const clamped = Math.min(Math.max(value, range.min), range.max);
  if (range.step === 0) {
    return clamped;
  }
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
