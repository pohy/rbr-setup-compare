import type { CarSetup } from "./lsp-parser.ts";

type FieldConfig = { modifier: number; unit: string };

const FIELD_CONFIGS: { test: (key: string) => boolean; config: FieldConfig }[] = [
  { test: (k) => k === "BumpHighSpeedBreak", config: { modifier: 1, unit: "m/s" } },
  { test: (k) => /Length|Height/.test(k), config: { modifier: 1000, unit: "mm" } },
  { test: (k) => k.includes("Stiffness"), config: { modifier: 0.001, unit: "kN/m" } },
  { test: (k) => k.includes("Damping"), config: { modifier: 0.001, unit: "kN/m/s" } },
  { test: (k) => k.includes("Pressure"), config: { modifier: 0.001, unit: "kPa" } },
  { test: (k) => k.includes("Torque"), config: { modifier: 1, unit: "Nm" } },
];

function getFieldConfig(key: string): FieldConfig | undefined {
  return FIELD_CONFIGS.find((f) => f.test(key))?.config;
}

export function getUnit(key: string): string | undefined {
  return getFieldConfig(key)?.unit;
}

export function getModifier(key: string): number {
  return getFieldConfig(key)?.modifier ?? 1;
}

export function unsanitizeValue(key: string, displayValue: number): number {
  const modifier = getModifier(key);
  if (modifier === 1) {
    return displayValue;
  }
  return displayValue / modifier;
}

function cleanNumber(n: number): number {
  const rounded = Math.round(n * 10000) / 10000;
  return rounded;
}

function formatCleanNumber(n: number): string {
  const cleaned = cleanNumber(n);
  return Number.isInteger(cleaned) ? String(cleaned) : String(cleaned);
}

function sanitizeValue(key: string, value: number | string): number | string {
  if (typeof value === "string") {
    // Triple (or multi) values: clean each number, no unit conversion
    return value
      .split(" ")
      .map((part) => {
        const n = parseFloat(part);
        return Number.isNaN(n) ? part : formatCleanNumber(cleanNumber(n));
      })
      .join(" ");
  }

  const config = getFieldConfig(key);
  if (config) {
    return cleanNumber(value * config.modifier);
  }
  return cleanNumber(value);
}

export const SECTION_RENAMES: Record<string, string> = {
  SpringDamperLB: "SpringDamperBack",
  SpringDamperLF: "SpringDamperFront",
  TyreLB: "TyreBack",
  TyreLF: "TyreFront",
  WheelLB: "WheelBack",
  WheelLF: "WheelFront",
};

export const SECTION_MIRRORS: Record<string, string> = {
  SpringDamperLF: "SpringDamperRF",
  SpringDamperLB: "SpringDamperRB",
  TyreLF: "TyreRF",
  TyreLB: "TyreRB",
  WheelLF: "WheelRF",
  WheelLB: "WheelRB",
};

export const SECTION_DISCARD = new Set(Object.values(SECTION_MIRRORS));

export function sanitizeSetup(setup: CarSetup): CarSetup {
  const sections: CarSetup["sections"] = {};

  for (const [sectionName, section] of Object.entries(setup.sections)) {
    // Discard right-side sections
    if (SECTION_DISCARD.has(sectionName)) {
      continue;
    }

    // Remove Engine section if it only has Features_NGP
    if (sectionName === "Engine") {
      const keys = Object.keys(section.values);
      if (keys.length === 1 && keys[0] === "Features_NGP") {
        continue;
      }
    }

    // Sanitize values
    const values: Record<string, number | string> = {};
    for (const [key, val] of Object.entries(section.values)) {
      values[key] = sanitizeValue(key, val);
    }

    // Rename L-side sections
    const newName = SECTION_RENAMES[sectionName] ?? sectionName;

    sections[newName] = { id: section.id, values };
  }

  return { name: setup.name, sections };
}

export function restoreMirroredSections(setup: CarSetup): CarSetup {
  const sections = { ...setup.sections };

  // Restore Engine section with Features_NGP (required by RBR, always 0)
  if (!sections.Engine) {
    sections.Engine = { id: ":-D", values: { Features_NGP: 0 } };
  }

  for (const [left, right] of Object.entries(SECTION_MIRRORS)) {
    if (sections[left] && !sections[right]) {
      const src = sections[left];
      sections[right] = {
        id: src.id,
        values: { ...src.values },
        ...(src.rawValues ? { rawValues: { ...src.rawValues } } : {}),
      };
    }
  }

  return { name: setup.name, sections };
}
