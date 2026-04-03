import { SETUP_SCHEMA } from "../generated/setup-schema.ts";
import type { CarSetup } from "./lsp-parser.ts";
import { getUnit, SECTION_RENAMES, sanitizeSetup } from "./sanitize.ts";

// Build canonical order lookups from SETUP_SCHEMA using sanitized section names
const SECTION_ORDER = new Map<string, number>();
const SECTION_KEY_ORDER = new Map<string, Map<string, number>>();

for (let i = 0; i < SETUP_SCHEMA.length; i++) {
  const [rawSection, key] = SETUP_SCHEMA[i];
  const section = SECTION_RENAMES[rawSection] ?? rawSection;

  if (!SECTION_ORDER.has(section)) {
    SECTION_ORDER.set(section, SECTION_ORDER.size);
  }

  let keyMap = SECTION_KEY_ORDER.get(section);
  if (!keyMap) {
    keyMap = new Map<string, number>();
    SECTION_KEY_ORDER.set(section, keyMap);
  }
  if (!keyMap.has(key)) {
    keyMap.set(key, keyMap.size);
  }
}

function canonicalSort<T>(items: T[], orderMap: Map<T, number>): void {
  const fallback = orderMap.size;
  items.sort((a, b) => (orderMap.get(a) ?? fallback) - (orderMap.get(b) ?? fallback));
}

const TOLERANCE = 0.0001;

export type ComparisonRow = {
  type: "data";
  key: string;
  values: (number | string | null)[];
  isDifferent: boolean;
  unit?: string;
};

export type SplitRatioRow = {
  type: "split";
  pairKey: string;
  ratios: (string | null)[];
};

export type DisplayRow = ComparisonRow | SplitRatioRow;

export type SectionComparison = {
  sectionName: string;
  rows: DisplayRow[];
};

export type ComparisonResult = SectionComparison[];

export function compareSetups(rawSetups: CarSetup[]): ComparisonResult {
  if (rawSetups.length === 0) {
    return [];
  }

  const setups = rawSetups.map(sanitizeSetup);

  // Collect all section names in order of first appearance
  const sectionNames: string[] = [];
  const sectionNameSet = new Set<string>();
  for (const setup of setups) {
    for (const name of Object.keys(setup.sections)) {
      if (!sectionNameSet.has(name)) {
        sectionNameSet.add(name);
        sectionNames.push(name);
      }
    }
  }

  canonicalSort(sectionNames, SECTION_ORDER);

  return sectionNames.map((sectionName) => {
    // Collect all keys in this section across all setups
    const keyOrder: string[] = [];
    const keySet = new Set<string>();
    for (const setup of setups) {
      const section = setup.sections[sectionName];
      if (!section) {
        continue;
      }
      for (const key of Object.keys(section.values)) {
        if (!keySet.has(key)) {
          keySet.add(key);
          keyOrder.push(key);
        }
      }
    }

    canonicalSort(keyOrder, SECTION_KEY_ORDER.get(sectionName) ?? new Map());

    const rows: ComparisonRow[] = keyOrder
      .map((key) => {
        const values = setups.map((setup) => {
          const section = setup.sections[sectionName];
          if (!section) {
            return null;
          }
          return section.values[key] ?? null;
        });

        const nonNull = values.filter((v) => v !== null);
        const allNumeric = nonNull.length > 0 && nonNull.every((v) => typeof v === "number");
        const isDifferent =
          nonNull.length > 1
            ? allNumeric
              ? nonNull.some((v) => Math.abs((v as number) - (nonNull[0] as number)) >= TOLERANCE)
              : nonNull.some((v) => String(v) !== String(nonNull[0]))
            : nonNull.length !== values.length;

        // Hide rows where every value is null or 0
        const isEmpty = values.every((v) => v === null || v === 0);

        return { type: "data" as const, key, values, isDifferent, unit: getUnit(key), isEmpty };
      })
      .filter((row) => !row.isEmpty);

    return { sectionName, rows: groupFrontRearPairs(rows) };
  });
}

export function parseFrontRearKey(
  key: string,
): { side: "Front" | "Rear"; counterpart: string } | null {
  const frontIdx = key.indexOf("Front");
  if (frontIdx !== -1) {
    return {
      side: "Front",
      counterpart: `${key.slice(0, frontIdx)}Rear${key.slice(frontIdx + 5)}`,
    };
  }
  const rearIdx = key.indexOf("Rear");
  if (rearIdx !== -1) {
    return { side: "Rear", counterpart: `${key.slice(0, rearIdx)}Front${key.slice(rearIdx + 4)}` };
  }
  return null;
}

export function computeRatio(
  front: number | string | null,
  rear: number | string | null,
): string | null {
  const f = typeof front === "number" ? front : Number(front);
  const r = typeof rear === "number" ? rear : Number(rear);
  if (front === null || rear === null || Number.isNaN(f) || Number.isNaN(r)) {
    return null;
  }
  const sum = f + r;
  if (sum === 0) {
    return null;
  }
  const frontPct = Math.round((f / sum) * 100);
  return `${frontPct}:${100 - frontPct}`;
}

function groupFrontRearPairs(rows: ComparisonRow[]): DisplayRow[] {
  const indexedKeyPattern = /_\d{2}$/;
  const result: DisplayRow[] = [];
  const emitted = new Set<string>();

  // Build a map for fast lookup
  const rowByKey = new Map<string, ComparisonRow>();
  for (const row of rows) {
    rowByKey.set(row.key, row);
  }

  for (const row of rows) {
    if (emitted.has(row.key)) {
      continue;
    }

    if (indexedKeyPattern.test(row.key)) {
      result.push(row);
      emitted.add(row.key);
      continue;
    }

    const parsed = parseFrontRearKey(row.key);
    if (!parsed) {
      result.push(row);
      emitted.add(row.key);
      continue;
    }

    const counterpart = rowByKey.get(parsed.counterpart);
    if (!counterpart || emitted.has(parsed.counterpart)) {
      result.push(row);
      emitted.add(row.key);
      continue;
    }

    // Emit front, then split ratio, then rear
    const frontRow = parsed.side === "Front" ? row : counterpart;
    const rearRow = parsed.side === "Rear" ? row : counterpart;

    const baseName = frontRow.key.replace("Front", "");
    const ratios = frontRow.values.map((_, i) =>
      computeRatio(frontRow.values[i], rearRow.values[i]),
    );

    result.push(frontRow);
    result.push({ type: "split", pairKey: baseName, ratios });
    result.push(rearRow);
    emitted.add(frontRow.key);
    emitted.add(rearRow.key);
  }

  return result;
}
