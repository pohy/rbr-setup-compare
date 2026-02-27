export type ScannedSetup = {
  relativePath: string;
  carName: string;
  fileName: string;
  source: "driver-setup" | "user-setup";
  fileHandle: FileSystemFileHandle;
};

export type CarGroup = {
  carName: string;
  setups: ScannedSetup[];
};

function formatCarName(dirName: string): string {
  return dirName.replace(/_ngp6$/i, "").replace(/_/g, " ");
}

async function tryGetDirectory(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await parent.getDirectoryHandle(name);
    console.log(`[rbr-scan] Found directory: ${name}`);
    return handle;
  } catch {
    console.log(`[rbr-scan] Directory not found: ${name} (in ${parent.name})`);
    return null;
  }
}

async function collectLspFiles(
  dir: FileSystemDirectoryHandle,
  pathPrefix: string,
  carName: string,
  source: ScannedSetup["source"],
): Promise<ScannedSetup[]> {
  const results: ScannedSetup[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file" && name.endsWith(".lsp")) {
      results.push({
        relativePath: `${pathPrefix}/${name}`,
        carName,
        fileName: name,
        source,
        fileHandle: handle as FileSystemFileHandle,
      });
    }
  }
  return results;
}

async function scanRsfDataCars(root: FileSystemDirectoryHandle): Promise<ScannedSetup[]> {
  const rsfdata = await tryGetDirectory(root, "rsfdata");
  if (!rsfdata) return [];
  const cars = await tryGetDirectory(rsfdata, "cars");
  if (!cars) return [];

  const results: ScannedSetup[] = [];
  for await (const [carDir, carHandle] of cars.entries()) {
    if (carHandle.kind !== "directory") continue;
    console.log(`[rbr-scan] rsfdata/cars: checking car dir "${carDir}"`);
    const setups = await tryGetDirectory(carHandle as FileSystemDirectoryHandle, "setups");
    if (!setups) continue;
    const carName = formatCarName(carDir);
    const files = await collectLspFiles(
      setups,
      `rsfdata/cars/${carDir}/setups`,
      carName,
      "driver-setup",
    );
    console.log(`[rbr-scan] rsfdata/cars/${carDir}/setups: found ${files.length} .lsp files`);
    results.push(...files);
  }
  console.log(`[rbr-scan] scanRsfDataCars total: ${results.length}`);
  return results;
}

async function scanRsfDataSetups(root: FileSystemDirectoryHandle): Promise<ScannedSetup[]> {
  const rsfdata = await tryGetDirectory(root, "rsfdata");
  if (!rsfdata) return [];
  const setups = await tryGetDirectory(rsfdata, "setups");
  if (!setups) return [];

  const results: ScannedSetup[] = [];
  for await (const [carDir, carHandle] of setups.entries()) {
    if (carHandle.kind !== "directory") continue;
    console.log(`[rbr-scan] rsfdata/setups: checking car dir "${carDir}"`);
    const carName = formatCarName(carDir);
    const files = await collectLspFiles(
      carHandle as FileSystemDirectoryHandle,
      `rsfdata/setups/${carDir}`,
      carName,
      "user-setup",
    );
    console.log(`[rbr-scan] rsfdata/setups/${carDir}: found ${files.length} .lsp files`);
    results.push(...files);
  }
  console.log(`[rbr-scan] scanRsfDataSetups total: ${results.length}`);
  return results;
}

async function scanPhysics(root: FileSystemDirectoryHandle): Promise<ScannedSetup[]> {
  const physics = await tryGetDirectory(root, "Physics");
  if (!physics) return [];

  const results: ScannedSetup[] = [];
  for await (const [carDir, carHandle] of physics.entries()) {
    if (carHandle.kind !== "directory") continue;
    console.log(`[rbr-scan] Physics: checking car dir "${carDir}"`);
    const setups = await tryGetDirectory(carHandle as FileSystemDirectoryHandle, "setups");
    if (!setups) continue;
    const carName = formatCarName(carDir);
    const files = await collectLspFiles(
      setups,
      `Physics/${carDir}/setups`,
      carName,
      "driver-setup",
    );
    console.log(`[rbr-scan] Physics/${carDir}/setups: found ${files.length} .lsp files`);
    results.push(...files);
  }
  console.log(`[rbr-scan] scanPhysics total: ${results.length}`);
  return results;
}

const RSF_DEFAULT_COPY_RE = /^\d+_d_/;

async function scanSavedGames(root: FileSystemDirectoryHandle): Promise<ScannedSetup[]> {
  const savedGames = await tryGetDirectory(root, "SavedGames");
  if (!savedGames) return [];

  const results: ScannedSetup[] = [];
  for await (const [carDir, carHandle] of savedGames.entries()) {
    if (carHandle.kind !== "directory") continue;
    console.log(`[rbr-scan] SavedGames: checking car dir "${carDir}"`);
    const carName = formatCarName(carDir);
    const files = await collectLspFiles(
      carHandle as FileSystemDirectoryHandle,
      `SavedGames/${carDir}`,
      carName,
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
        const file = await setup.fileHandle.getFile();
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

export async function scanRbrDirectory(root: FileSystemDirectoryHandle): Promise<CarGroup[]> {
  const [rsfCars, rsfSetups, physics, savedGames] = await Promise.all([
    scanRsfDataCars(root),
    scanRsfDataSetups(root),
    scanPhysics(root),
    scanSavedGames(root),
  ]);

  const all = [...rsfCars, ...rsfSetups, ...physics, ...savedGames];
  console.log(
    `[rbr-scan] Scan complete — rsfCars: ${rsfCars.length}, rsfSetups: ${rsfSetups.length}, physics: ${physics.length}, savedGames: ${savedGames.length}, total: ${all.length}`,
  );
  if (all.length === 0) {
    throw new Error("No RBR setup directories found.");
  }

  const deduplicated = await deduplicateSetups(all);

  // Group by car name
  const grouped = new Map<string, ScannedSetup[]>();
  for (const setup of deduplicated) {
    const existing = grouped.get(setup.carName);
    if (existing) {
      existing.push(setup);
    } else {
      grouped.set(setup.carName, [setup]);
    }
  }

  // Sort groups alphabetically, files within each group by name
  const groups: CarGroup[] = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([carName, setups]) => ({
      carName,
      setups: setups.sort((a, b) => a.fileName.localeCompare(b.fileName)),
    }));

  return groups;
}
