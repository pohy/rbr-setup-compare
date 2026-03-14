import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseRangeFile, type RawRangeData } from "./src/lib/range-parser.ts";

const RBR_DIR = "/mnt/e/David/Games/Richard Burns Rally";

function formatCarName(dirName: string): string {
  return dirName.replace(/_ngp6$/i, "").replace(/_/g, " ");
}

type CarRangeFile = { carName: string; surface: string; path: string };

function findRangeFiles(): CarRangeFile[] {
  const results: CarRangeFile[] = [];
  const RANGE_RE = /^r_(.+)\.lsp$/;
  const seen = new Set<string>();

  for (const location of ["rsfdata/cars", "Physics"]) {
    const dir = join(RBR_DIR, location);
    try {
      for (const carDir of readdirSync(dir)) {
        const carPath = join(dir, carDir);
        try {
          if (!statSync(carPath).isDirectory()) continue;
        } catch {
          continue;
        }
        const carName = formatCarName(carDir);
        try {
          for (const file of readdirSync(carPath)) {
            const match = file.match(RANGE_RE);
            if (!match) continue;
            const key = `${carName}\0${match[1]}`;
            if (seen.has(key)) continue; // prefer rsfdata over Physics
            seen.add(key);
            results.push({ carName, surface: match[1], path: join(carPath, file) });
          }
        } catch {
          // can't read car dir
        }
      }
    } catch {
      // location doesn't exist
    }
  }
  return results;
}

const rangeFiles = findRangeFiles();
console.error(`Found ${rangeFiles.length} range files`);

// Group by car, merge raw range data from all surfaces
const carRawRanges = new Map<string, RawRangeData>();
let failed = 0;

for (const { carName, path } of rangeFiles) {
  try {
    const text = readFileSync(path, "utf-8");
    const raw = parseRangeFile(text);

    const existing = carRawRanges.get(carName) ?? new Map();
    for (const [section, keys] of raw) {
      const existingSection = existing.get(section) ?? new Map();
      for (const [key, triplet] of keys) {
        if (!existingSection.has(key)) {
          existingSection.set(key, triplet);
        }
      }
      existing.set(section, existingSection);
    }
    carRawRanges.set(carName, existing);
  } catch (e) {
    failed++;
    console.error(`  FAIL: ${path}: ${e instanceof Error ? e.message : e}`);
  }
}

const cars = [...carRawRanges.entries()].sort(([a], [b]) => a.localeCompare(b));
console.error(
  `Processed ${cars.length} cars from ${rangeFiles.length} range files (${failed} failures)`,
);

// Output TypeScript
console.log("// Generated range data for static fallback");
console.log(`// ${cars.length} cars from ${rangeFiles.length} range files`);
console.log("// Regenerate with: pnpm gen-ranges");
console.log("type T = [number, number, number]; // [min, max, step]");
console.log("");
console.log("export const STATIC_RANGES: Record<string, Record<string, Record<string, T>>> = {");

for (const [carName, rangeData] of cars) {
  console.log(`  ${JSON.stringify(carName)}: {`);
  const sections = [...rangeData.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [section, keys] of sections) {
    console.log(`    ${JSON.stringify(section)}: {`);
    const sortedKeys = [...keys.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [key, { min, max, step }] of sortedKeys) {
      console.log(`      ${JSON.stringify(key)}: [${min}, ${max}, ${step}],`);
    }
    console.log("    },");
  }
  console.log("  },");
}

console.log("};");
