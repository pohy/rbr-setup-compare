import { SETUP_SCHEMA } from "../generated/setup-schema.ts";
import type { CarSetup } from "./lsp-parser.ts";
import { restoreMirroredSections } from "./sanitize.ts";

// Build per-section canonical key order from SETUP_SCHEMA
const SECTION_KEY_ORDER = new Map<string, Map<string, number>>();
for (const [section, key] of SETUP_SCHEMA) {
  let keyMap = SECTION_KEY_ORDER.get(section);
  if (!keyMap) {
    keyMap = new Map<string, number>();
    SECTION_KEY_ORDER.set(section, keyMap);
  }
  if (!keyMap.has(key)) {
    keyMap.set(key, keyMap.size);
  }
}

const SECTION_ORDER = [
  "Car",
  "Drive",
  "Engine",
  "VehicleControlUnit",
  "WheelLF",
  "WheelRF",
  "WheelLB",
  "WheelRB",
  "SpringDamperLF",
  "SpringDamperRF",
  "SpringDamperLB",
  "SpringDamperRB",
  "TyreLF",
  "TyreRF",
  "TyreLB",
  "TyreRB",
];

function formatNumber(n: number): string {
  // Round to avoid floating-point noise (e.g. 0.30000000000000004 → 0.3)
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

function formatValue(value: number | string): string {
  if (typeof value === "string") {
    // Multi-value string: clean each number
    return value
      .split(" ")
      .map((part) => {
        const n = parseFloat(part);
        return Number.isNaN(n) ? part : formatNumber(n);
      })
      .join(" ");
  }
  return formatNumber(value);
}

export function setupToLsp(setup: CarSetup): string {
  setup = restoreMirroredSections(setup);
  const lines: string[] = ['(("CarSetup"'];

  // Emit sections in canonical order, then any remaining sections not in the order list
  const emitted = new Set<string>();
  const orderedNames = [
    ...SECTION_ORDER,
    ...Object.keys(setup.sections).filter((n) => !SECTION_ORDER.includes(n)),
  ];

  for (const name of orderedNames) {
    if (emitted.has(name)) {
      continue;
    }
    const section = setup.sections[name];
    if (!section) {
      continue;
    }
    emitted.add(name);

    const id = section.id || (name === "Car" ? "Car" : ":-D");

    lines.push(`  ${name}`);
    lines.push(`  ("${id}"`);

    const keyOrder = SECTION_KEY_ORDER.get(name);
    const sortedEntries = Object.entries(section.values).sort(([a], [b]) => {
      const ai = keyOrder?.get(a) ?? Infinity;
      const bi = keyOrder?.get(b) ?? Infinity;
      return ai - bi;
    });

    for (const [key, val] of sortedEntries) {
      const raw = section.rawValues?.[key];
      const formatted = raw ?? formatValue(val);
      lines.push(`   ${key}\t\t\t\t\t\t\t${formatted}`);
    }

    lines.push("   )");
  }

  lines.push("))");
  lines.push("");

  return lines.join("\n");
}
