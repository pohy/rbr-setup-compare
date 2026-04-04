import {
  type CarGroup,
  formatCarName,
  type IDirectoryHandle,
  RANGE_FILE_RE,
  type RangeFileEntry,
  RSF_DEFAULT_COPY_RE,
  type ScannedSetup,
} from "./scanner-types.ts";

export type { CarGroup, RangeFileEntry, ScannedSetup };

async function tryGetDirectory(
  parent: IDirectoryHandle,
  name: string,
): Promise<IDirectoryHandle | null> {
  try {
    const handle = await parent.getDirectoryHandle(name);
    console.log(`[rbr-scan] Found directory: ${name}`);
    return handle;
  } catch {
    console.log(`[rbr-scan] Directory not found: ${name} (in ${parent.name})`);
    return null;
  }
}

async function collectRangeFiles(dir: IDirectoryHandle): Promise<RangeFileEntry[]> {
  const results: RangeFileEntry[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== "file") {
      continue;
    }
    const match = name.match(RANGE_FILE_RE);
    if (match) {
      results.push({ surface: match[1], fileRef: handle });
    }
  }
  return results;
}

async function collectLspFiles(
  dir: IDirectoryHandle,
  pathPrefix: string,
  carName: string,
  carDir: string,
  source: ScannedSetup["source"],
): Promise<ScannedSetup[]> {
  const results: ScannedSetup[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file" && name.endsWith(".lsp")) {
      results.push({
        relativePath: `${pathPrefix}/${name}`,
        carName,
        carDir,
        fileName: name,
        source,
        fileRef: handle,
      });
    }
  }
  return results;
}

type ScanResult = {
  setups: ScannedSetup[];
  rangeFiles: Map<string, RangeFileEntry[]>;
};

async function scanRsfDataCars(root: IDirectoryHandle): Promise<ScanResult> {
  const rsfdata = await tryGetDirectory(root, "rsfdata");
  if (!rsfdata) {
    return { setups: [], rangeFiles: new Map() };
  }
  const cars = await tryGetDirectory(rsfdata, "cars");
  if (!cars) {
    return { setups: [], rangeFiles: new Map() };
  }

  const setups: ScannedSetup[] = [];
  const rangeFiles = new Map<string, RangeFileEntry[]>();
  for await (const [carDir, carHandle] of cars.entries()) {
    if (carHandle.kind !== "directory") {
      continue;
    }
    console.log(`[rbr-scan] rsfdata/cars: checking car dir "${carDir}"`);
    const carName = formatCarName(carDir);

    // Collect range files from car directory root
    const ranges = await collectRangeFiles(carHandle);
    if (ranges.length > 0) {
      rangeFiles.set(carName, ranges);
    }

    const setupsDir = await tryGetDirectory(carHandle, "setups");
    if (!setupsDir) {
      continue;
    }
    const files = await collectLspFiles(
      setupsDir,
      `rsfdata/cars/${carDir}/setups`,
      carName,
      carDir,
      "driver-setup",
    );
    console.log(`[rbr-scan] rsfdata/cars/${carDir}/setups: found ${files.length} .lsp files`);
    setups.push(...files);
  }
  console.log(`[rbr-scan] scanRsfDataCars total: ${setups.length}`);
  return { setups, rangeFiles };
}

async function scanRsfDataSetups(root: IDirectoryHandle): Promise<ScannedSetup[]> {
  const rsfdata = await tryGetDirectory(root, "rsfdata");
  if (!rsfdata) {
    return [];
  }
  const setups = await tryGetDirectory(rsfdata, "setups");
  if (!setups) {
    return [];
  }

  const results: ScannedSetup[] = [];
  for await (const [carDir, carHandle] of setups.entries()) {
    if (carHandle.kind !== "directory") {
      continue;
    }
    console.log(`[rbr-scan] rsfdata/setups: checking car dir "${carDir}"`);
    const carName = formatCarName(carDir);
    const files = await collectLspFiles(
      carHandle,
      `rsfdata/setups/${carDir}`,
      carName,
      carDir,
      "user-setup",
    );
    console.log(`[rbr-scan] rsfdata/setups/${carDir}: found ${files.length} .lsp files`);
    results.push(...files);
  }
  console.log(`[rbr-scan] scanRsfDataSetups total: ${results.length}`);
  return results;
}

async function scanPhysics(root: IDirectoryHandle): Promise<ScanResult> {
  const physics = await tryGetDirectory(root, "Physics");
  if (!physics) {
    return { setups: [], rangeFiles: new Map() };
  }

  const setups: ScannedSetup[] = [];
  const rangeFiles = new Map<string, RangeFileEntry[]>();
  for await (const [carDir, carHandle] of physics.entries()) {
    if (carHandle.kind !== "directory") {
      continue;
    }
    console.log(`[rbr-scan] Physics: checking car dir "${carDir}"`);
    const carName = formatCarName(carDir);

    // Collect range files from car directory root
    const ranges = await collectRangeFiles(carHandle);
    if (ranges.length > 0 && !rangeFiles.has(carName)) {
      rangeFiles.set(carName, ranges);
    }

    const setupsDir = await tryGetDirectory(carHandle, "setups");
    if (!setupsDir) {
      continue;
    }
    const files = await collectLspFiles(
      setupsDir,
      `Physics/${carDir}/setups`,
      carName,
      carDir,
      "driver-setup",
    );
    console.log(`[rbr-scan] Physics/${carDir}/setups: found ${files.length} .lsp files`);
    setups.push(...files);
  }
  console.log(`[rbr-scan] scanPhysics total: ${setups.length}`);
  return { setups, rangeFiles };
}

async function scanSavedGames(root: IDirectoryHandle): Promise<ScannedSetup[]> {
  const savedGames = await tryGetDirectory(root, "SavedGames");
  if (!savedGames) {
    return [];
  }

  const results: ScannedSetup[] = [];
  for await (const [carDir, carHandle] of savedGames.entries()) {
    if (carHandle.kind !== "directory") {
      continue;
    }
    console.log(`[rbr-scan] SavedGames: checking car dir "${carDir}"`);
    const carName = formatCarName(carDir);
    const files = await collectLspFiles(
      carHandle,
      `SavedGames/${carDir}`,
      carName,
      carDir,
      "user-setup",
    );
    const filtered = files.filter((f) => !RSF_DEFAULT_COPY_RE.test(f.fileName));
    console.log(
      `[rbr-scan] SavedGames/${carDir}: found ${files.length} .lsp files, kept ${filtered.length} (filtered ${files.length - filtered.length} RSF defaults)`,
    );
    results.push(...filtered);
  }
  console.log(`[rbr-scan] scanSavedGames total: ${results.length}`);
  return results;
}

async function deduplicateSetups(setups: ScannedSetup[]): Promise<ScannedSetup[]> {
  const byKey = new Map<string, ScannedSetup[]>();
  for (const setup of setups) {
    const key = `${setup.carName}\0${setup.fileName}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.push(setup);
    } else {
      byKey.set(key, [setup]);
    }
  }

  const results: ScannedSetup[] = [];
  let removed = 0;
  for (const group of byKey.values()) {
    if (group.length === 1) {
      results.push(group[0]);
      continue;
    }
    const withTimestamps = await Promise.all(
      group.map(async (setup) => {
        const file = await setup.fileRef.getFile();
        return { setup, lastModified: file.lastModified };
      }),
    );
    withTimestamps.sort((a, b) => b.lastModified - a.lastModified);
    results.push(withTimestamps[0].setup);
    removed += group.length - 1;
  }

  if (removed > 0) {
    console.log(`[rbr-scan] Deduplicated: removed ${removed} duplicates`);
  }
  return results;
}

function mergeRangeFiles(
  ...sources: Map<string, RangeFileEntry[]>[]
): Map<string, RangeFileEntry[]> {
  const merged = new Map<string, RangeFileEntry[]>();
  for (const source of sources) {
    for (const [carName, entries] of source) {
      const existing = merged.get(carName);
      if (!existing) {
        merged.set(carName, [...entries]);
      } else {
        // Dedup by surface, prefer earlier sources (rsfdata over Physics)
        const surfaces = new Set(existing.map((e) => e.surface));
        for (const entry of entries) {
          if (!surfaces.has(entry.surface)) {
            existing.push(entry);
            surfaces.add(entry.surface);
          }
        }
      }
    }
  }
  return merged;
}

export async function scanRbrDirectory(root: IDirectoryHandle): Promise<CarGroup[]> {
  const [rsfCars, rsfSetups, physics, savedGames] = await Promise.all([
    scanRsfDataCars(root),
    scanRsfDataSetups(root),
    scanPhysics(root),
    scanSavedGames(root),
  ]);

  const all = [...rsfCars.setups, ...rsfSetups, ...physics.setups, ...savedGames];
  console.log(
    `[rbr-scan] Scan complete — rsfCars: ${rsfCars.setups.length}, rsfSetups: ${rsfSetups.length}, physics: ${physics.setups.length}, savedGames: ${savedGames.length}, total: ${all.length}`,
  );
  if (all.length === 0) {
    throw new Error("No RBR setup directories found.");
  }

  const deduplicated = await deduplicateSetups(all);

  // Merge range files: prefer rsfdata over Physics
  const allRangeFiles = mergeRangeFiles(rsfCars.rangeFiles, physics.rangeFiles);

  // Group by car name
  const grouped = new Map<string, { carDir: string; setups: ScannedSetup[] }>();
  for (const setup of deduplicated) {
    const existing = grouped.get(setup.carName);
    if (existing) {
      existing.setups.push(setup);
    } else {
      grouped.set(setup.carName, { carDir: setup.carDir, setups: [setup] });
    }
  }

  // Sort groups alphabetically, files within each group by name
  const groups: CarGroup[] = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([carName, { carDir, setups }]) => ({
      carName,
      carDir,
      setups: setups.sort((a, b) => a.fileName.localeCompare(b.fileName)),
      rangeFiles: allRangeFiles.get(carName) ?? [],
      carInfo: null,
    }));

  return groups;
}
