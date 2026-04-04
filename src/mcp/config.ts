import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_FILE = ".rbr-tuner.json";

type Config = {
  rbrDir: string;
};

export function configPath(projectRoot: string): string {
  return join(projectRoot, CONFIG_FILE);
}

export async function loadConfig(projectRoot: string): Promise<Config | null> {
  try {
    const text = await readFile(configPath(projectRoot), "utf-8");
    const data = JSON.parse(text);
    if (typeof data.rbrDir === "string") {
      return { rbrDir: data.rbrDir };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveConfig(projectRoot: string, config: Config): Promise<void> {
  await writeFile(configPath(projectRoot), `${JSON.stringify(config, null, "\t")}\n`);
}
