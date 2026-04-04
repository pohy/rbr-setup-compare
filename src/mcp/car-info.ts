import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CARLIST_URL = "https://gvrc.de/ngp/tools/rbrcit/carlist/carList.ini";
const CARLIST_CACHE_FILE = ".rbrtune-carlist.ini";

export type CarInfo = {
  name: string;
  drivetrain: string;
  weight: number;
  power: string;
  year: number;
  category: string;
};

/**
 * Parse the RBRCIT carList.ini content into a map keyed by `physics` field.
 * Skips commented-out sections (lines starting with ;).
 */
export function parseCarList(content: string): Map<string, CarInfo> {
  const map = new Map<string, CarInfo>();
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  let inCarSection = false;
  let fields: Record<string, string> = {};

  function flushCar() {
    const physics = fields.physics;
    if (physics && fields.trans && fields.weight && fields.power && fields.year && fields.cat) {
      map.set(physics, {
        name: fields.name || physics,
        drivetrain: fields.trans,
        weight: Number(fields.weight),
        power: fields.power,
        year: Number(fields.year),
        category: fields.cat,
      });
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith(";")) {
      continue;
    }

    // Section header
    if (trimmed.startsWith("[")) {
      if (inCarSection) {
        flushCar();
      }
      inCarSection = /^\[Car_\d+\]$/.test(trimmed);
      fields = {};
      continue;
    }

    // Key=Value within a car section
    if (inCarSection) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        fields[key] = value;
      }
    }
  }
  // Flush last section
  if (inCarSection) {
    flushCar();
  }

  return map;
}

/** Exact-match lookup by physics name (= car name text file first line). */
export function resolveCarInfo(carList: Map<string, CarInfo>, physicsName: string): CarInfo | null {
  return carList.get(physicsName) ?? null;
}

/** Format a one-liner summary for list_cars output. */
export function formatCarSummary(info: CarInfo): string {
  const parts = [info.drivetrain, `${info.weight} kg`];

  if (info.power.includes("@")) {
    const [bhp, rpm] = info.power.split("@");
    parts.push(`${bhp} bhp @ ${rpm} rpm`);
  } else {
    parts.push(`${info.power} bhp`);
  }

  parts.push(info.category, String(info.year));
  return parts.join(" | ");
}

/**
 * Read the car name text file from a car physics directory.
 * This is the plain-text file (no extension, not .lsp/.ini/.zip) whose first line
 * is the canonical car name matching carList.ini's `physics` field.
 */
export async function readCarNameFromDir(carPhysicsDir: string): Promise<string | null> {
  try {
    const entries = await readdir(carPhysicsDir, { withFileTypes: true });
    const candidate = entries.find(
      (e) =>
        e.isFile() &&
        !e.name.endsWith(".lsp") &&
        !e.name.endsWith(".ini") &&
        !e.name.endsWith(".zip"),
    );
    if (!candidate) {
      return null;
    }
    const content = await readFile(join(carPhysicsDir, candidate.name), "utf-8");
    const firstLine = content.split(/\r?\n/)[0]?.trim();
    return firstLine || null;
  } catch {
    return null;
  }
}

/**
 * Fetch carList.ini from the remote URL and cache it locally.
 * Falls back to cached file on network failure.
 */
export async function fetchCarList(rbrDir: string): Promise<Map<string, CarInfo>> {
  const cachePath = join(rbrDir, CARLIST_CACHE_FILE);
  let content: string | null = null;

  try {
    const response = await fetch(CARLIST_URL, {
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (response.ok) {
      content = await response.text();
      // Cache for offline use
      await writeFile(cachePath, content).catch(() => {});
    }
  } catch {
    // Network failure — try cache
  }

  if (!content) {
    try {
      content = await readFile(cachePath, "utf-8");
    } catch {
      // No cache either
      return new Map();
    }
  }

  return parseCarList(content);
}

/**
 * Enrich car groups with car info from carList.ini.
 * Reads the car name text file from each car's physics directory and joins
 * against the carList map.
 */
export async function enrichCarGroups(
  carGroups: { carDir: string; carInfo: CarInfo | null }[],
  carList: Map<string, CarInfo>,
  rbrDir: string,
): Promise<void> {
  await Promise.all(
    carGroups.map(async (group) => {
      // Try rsfdata/cars/<carDir>/ first, then Physics/<carDir>/
      const candidates = [
        join(rbrDir, "rsfdata", "cars", group.carDir),
        join(rbrDir, "Physics", group.carDir),
      ];
      for (const dir of candidates) {
        const physicsName = await readCarNameFromDir(dir);
        if (physicsName) {
          group.carInfo = resolveCarInfo(carList, physicsName);
          break;
        }
      }
    }),
  );
}
