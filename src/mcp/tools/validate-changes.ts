import type { z } from "zod/v4";
import type { CarSetup } from "../../lib/lsp-parser.ts";
import { getRangeForKey, type RangeMap } from "../../lib/range-mapping.ts";
import {
  getModifier,
  SECTION_DISCARD,
  SECTION_MIRRORS,
  SECTION_RENAMES,
  unsanitizeValue,
} from "../../lib/sanitize.ts";
import { clampToRange } from "../../lib/setup-edits.ts";
import type { ChangeEntry } from "../schemas.ts";

// Reverse map: sanitized display name → raw name (e.g. "SpringDamperBack" → "SpringDamperLB")
const SECTION_UNRENAMES: Record<string, string> = {};
for (const [raw, display] of Object.entries(SECTION_RENAMES)) {
  SECTION_UNRENAMES[display] = raw;
}

/**
 * Resolves a section name that may be either raw (SpringDamperLB) or
 * sanitized/display (SpringDamperBack) to the raw name used in the setup file.
 */
export function resolveSectionName(name: string): string {
  return SECTION_UNRENAMES[name] ?? name;
}

export type ChangePreview = {
  section: string;
  key: string;
  before: number;
  requested: number;
  after: number;
  wasClamped: boolean;
  mirrored?: boolean;
  range?: { min: number; max: number; step: number };
};

/**
 * Validates and previews changes against a raw setup and range map.
 *
 * All input/output values are in raw (physics) units — the same as stored in the LSP file.
 * The MCP tool layer handles display-unit conversion for the LLM-facing interface.
 */
export function validateAndPreviewChanges(
  rawSetup: CarSetup,
  rangeMap: RangeMap,
  changes: z.infer<typeof ChangeEntry>[],
): ChangePreview[] {
  const previews: ChangePreview[] = [];

  for (const change of changes) {
    const section = resolveSectionName(change.section);
    const { key } = change;

    // Reject R-side sections (symmetric editing enforced)
    if (SECTION_DISCARD.has(section)) {
      // Find the L-side equivalent for a helpful suggestion
      const lSide = Object.entries(SECTION_RENAMES).find(
        ([, display]) => SECTION_UNRENAMES[display] === section.replace(/R([FB])$/, "L$1"),
      );
      const suggestion = lSide ? ` Use "${lSide[1]}" (or "${lSide[0]}") instead.` : "";
      throw new Error(
        `Section "${change.section}" is a right-side section — only specify one side, the other is mirrored automatically.${suggestion}`,
      );
    }

    // Look up current value in the raw setup
    const rawSection = rawSetup.sections[section];
    if (!rawSection) {
      // Show both raw and sanitized names so the LLM can use either
      const available = Object.keys(rawSetup.sections)
        .filter((s) => !SECTION_DISCARD.has(s))
        .map((s) => SECTION_RENAMES[s] ?? s);
      throw new Error(
        `Section "${change.section}" not found in setup. Available: ${available.join(", ")}`,
      );
    }
    const currentRaw = rawSection.values[key];
    if (currentRaw === undefined) {
      throw new Error(
        `Key "${key}" not found in section "${section}". Available: ${Object.keys(rawSection.values).join(", ")}`,
      );
    }
    if (typeof currentRaw !== "number") {
      throw new Error(`Key "${key}" has a non-numeric value and cannot be changed via this tool.`);
    }

    // Compute new raw value
    let requestedRaw: number;
    if (change.change.mode === "absolute") {
      // Input is in display units — convert to raw
      requestedRaw = unsanitizeValue(key, change.change.value);
    } else {
      // Relative: percentage on raw value (equivalent to display due to linear modifier)
      requestedRaw = currentRaw * (1 + change.change.percent / 100);
    }

    // Look up range and clamp (ranges are in raw units)
    const range = getRangeForKey(rangeMap, section, key);
    let afterRaw = requestedRaw;
    let wasClamped = false;
    if (range) {
      afterRaw = clampToRange(requestedRaw, range);
      wasClamped = afterRaw !== requestedRaw;
    }

    // Convert to display units for preview
    const modifier = getModifier(key);
    previews.push({
      section,
      key,
      before: currentRaw * modifier,
      requested: requestedRaw * modifier,
      after: afterRaw * modifier,
      wasClamped,
      range: range
        ? { min: range.min * modifier, max: range.max * modifier, step: range.step * modifier }
        : undefined,
    });
  }

  // Append mirrored R-side previews for any L-side section that has a mirror
  const mirroredPreviews: ChangePreview[] = [];
  for (const preview of previews) {
    const rSection = SECTION_MIRRORS[preview.section];
    if (!rSection) {
      continue;
    }
    mirroredPreviews.push({ ...preview, section: rSection, mirrored: true });
  }
  previews.push(...mirroredPreviews);

  return previews;
}

/**
 * Returns the raw (physics-unit) values to apply to the setup.
 * Call this after validateAndPreviewChanges to get the actual edit map.
 */
export function computeRawEdits(
  rawSetup: CarSetup,
  rangeMap: RangeMap,
  changes: z.infer<typeof ChangeEntry>[],
): Map<string, Map<string, number>> {
  const edits = new Map<string, Map<string, number>>();

  for (const change of changes) {
    const section = resolveSectionName(change.section);
    const currentRaw = rawSetup.sections[section]?.values[change.key];
    if (typeof currentRaw !== "number") {
      continue;
    }

    let newRaw: number;
    if (change.change.mode === "absolute") {
      newRaw = unsanitizeValue(change.key, change.change.value);
    } else {
      newRaw = currentRaw * (1 + change.change.percent / 100);
    }

    const range = getRangeForKey(rangeMap, section, change.key);
    if (range) {
      newRaw = clampToRange(newRaw, range);
    }

    let sectionEdits = edits.get(section);
    if (!sectionEdits) {
      sectionEdits = new Map();
      edits.set(section, sectionEdits);
    }
    sectionEdits.set(change.key, newRaw);
  }

  return edits;
}
