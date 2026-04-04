import { readFile, writeFile } from "node:fs/promises";

export type McpSidecar = {
  managed: true;
  updated: string;
  base?: string;
  meta?: Record<string, unknown>;
};

export function sidecarPath(lspPath: string): string {
  return `${lspPath}.json`;
}

export async function writeMcpSidecar(
  lspPath: string,
  options: { base?: string; meta?: Record<string, unknown> },
): Promise<void> {
  const data: McpSidecar = {
    managed: true,
    updated: new Date().toISOString(),
  };
  if (options.base) {
    data.base = options.base;
  }
  if (options.meta) {
    data.meta = options.meta;
  }
  await writeFile(sidecarPath(lspPath), JSON.stringify(data, null, 2), "utf-8");
}

export async function readMcpSidecar(lspPath: string): Promise<McpSidecar | null> {
  try {
    const content = await readFile(sidecarPath(lspPath), "utf-8");
    return JSON.parse(content) as McpSidecar;
  } catch {
    return null;
  }
}

export async function isMcpManaged(lspPath: string): Promise<boolean> {
  try {
    await readFile(sidecarPath(lspPath));
    return true;
  } catch {
    return false;
  }
}
