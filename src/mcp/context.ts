import type { CarGroup } from "../lib/scanner-types.ts";

export type McpContext = {
  projectRoot: string;
  rbrDir: string | null;
  carGroups: CarGroup[];
};

export function requireRbrDir(ctx: McpContext): string {
  if (!ctx.rbrDir) {
    throw new Error("RBR directory not configured. Use the set_rbr_directory tool first.");
  }
  return ctx.rbrDir;
}

export function findCarGroup(ctx: McpContext, carName: string): CarGroup {
  const group = ctx.carGroups.find((g) => g.carName.toLowerCase() === carName.toLowerCase());
  if (!group) {
    const available = ctx.carGroups.map((g) => g.carName).join(", ");
    throw new Error(`Car "${carName}" not found. Available: ${available}`);
  }
  return group;
}

export function findSetup(group: CarGroup, fileName: string) {
  const setup = group.setups.find((s) => s.fileName.toLowerCase() === fileName.toLowerCase());
  if (!setup) {
    const available = group.setups.map((s) => s.fileName).join(", ");
    throw new Error(`Setup "${fileName}" not found for ${group.carName}. Available: ${available}`);
  }
  return setup;
}

export function findRangeFile(group: CarGroup, surface: string) {
  const entry =
    group.rangeFiles.find((r) => r.surface.toLowerCase() === surface.toLowerCase()) ??
    group.rangeFiles[0];
  if (!entry) {
    throw new Error(`No range files found for ${group.carName}.`);
  }
  return entry;
}
