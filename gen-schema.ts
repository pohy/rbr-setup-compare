import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseLspSetup } from "./src/lib/lsp-parser.ts";

const RBR_DIR = "/mnt/e/David/Games/Richard Burns Rally";

function findLspFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...findLspFiles(full));
        } else if (entry.endsWith(".lsp")) {
          results.push(full);
        }
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // skip inaccessible
  }
  return results;
}

// Collect setup files from all 4 locations + bundled examples
const files = [
  "data/Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp",
  "data/Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_gravel.lsp",
  "data/Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_snow.lsp",
  ...findLspFiles(join(RBR_DIR, "rsfdata/cars")).filter((f) => f.includes("/setups/")),
  ...findLspFiles(join(RBR_DIR, "rsfdata/setups")),
  ...findLspFiles(join(RBR_DIR, "Physics")).filter((f) => f.includes("/setups/")),
  ...findLspFiles(join(RBR_DIR, "SavedGames")),
];

console.error(`Scanning ${files.length} setup files...`);

const seen = new Set<string>();
const schema: [string, string][] = [];
let parsed = 0;
let failed = 0;

// Right-side sections are always discarded by sanitizeSetup — skip them
const SECTION_DISCARD = new Set([
  "SpringDamperRB",
  "SpringDamperRF",
  "TyreRB",
  "TyreRF",
  "WheelRB",
  "WheelRF",
]);

for (const file of files) {
  try {
    const content = readFileSync(file, "utf-8");
    const setup = parseLspSetup(content, file);
    for (const [sectionName, section] of Object.entries(setup.sections)) {
      if (SECTION_DISCARD.has(sectionName)) continue;

      // Skip Engine section if it only has Features_NGP
      if (sectionName === "Engine") {
        const keys = Object.keys(section.values);
        if (keys.length === 1 && keys[0] === "Features_NGP") continue;
      }

      for (const key of Object.keys(section.values)) {
        const composite = `${sectionName}.${key}`;
        if (!seen.has(composite)) {
          seen.add(composite);
          schema.push([sectionName, key]);
        }
      }
    }
    parsed++;
  } catch (e) {
    failed++;
    console.error(`  FAIL: ${file}: ${e instanceof Error ? e.message : e}`);
  }
}

console.error(`Parsed ${parsed} files (${failed} failures), found ${schema.length} unique keys`);

console.log(`// Generated from ${parsed} setup files (${schema.length} entries)`);
console.log("// Schema version 1 — if this list changes, bump the version in url-sharing.ts");
console.log("// Regenerate with: pnpm dlx tsx gen-schema.ts");
console.log("export const SETUP_SCHEMA: [string, string][] = [");
for (const [section, key] of schema) {
  console.log(`  ["${section}", "${key}"],`);
}
console.log("];");
console.log("");
console.log("export const SCHEMA_KEYS = new Set(SETUP_SCHEMA.map(([s, k]) => `${s}.${k}`));");
