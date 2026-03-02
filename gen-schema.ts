import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseLspSetup } from "./src/lib/lsp-parser.ts";
import { sanitizeSetup } from "./src/lib/sanitize.ts";

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

for (const file of files) {
  try {
    const content = readFileSync(file, "utf-8");
    const setup = parseLspSetup(content, file);
    const sanitized = sanitizeSetup(setup);
    for (const [sectionName, section] of Object.entries(sanitized.sections)) {
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
console.log("export const SETUP_SCHEMA: [string, string][] = [");
for (const [section, key] of schema) {
  console.log(`  ["${section}", "${key}"],`);
}
console.log("];");
