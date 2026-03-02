import type { CarSetup } from "./lsp-parser.ts";

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
  const lines: string[] = ['(("CarSetup"'];

  // Emit sections in canonical order, then any remaining sections not in the order list
  const emitted = new Set<string>();
  const orderedNames = [
    ...SECTION_ORDER,
    ...Object.keys(setup.sections).filter((n) => !SECTION_ORDER.includes(n)),
  ];

  for (const name of orderedNames) {
    if (emitted.has(name)) continue;
    const section = setup.sections[name];
    if (!section) continue;
    emitted.add(name);

    const id = section.id || (name === "Car" ? "Car" : ":-D");

    lines.push(`  ${name}`);
    lines.push(`  ("${id}"`);

    for (const [key, val] of Object.entries(section.values)) {
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
