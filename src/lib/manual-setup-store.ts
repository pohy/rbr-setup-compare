import { type CarSetup, parseLspSetup } from "./lsp-parser.ts";

export type ManualSetupEntry = {
  id: string;
  name: string;
  text: string;
};

export type RehydratedSetup = CarSetup & { manualId: string };

export function createManualEntry(name: string, text: string): ManualSetupEntry {
  return { id: crypto.randomUUID(), name, text };
}

export function rehydrateSetups(entries: ManualSetupEntry[]): RehydratedSetup[] {
  const results: RehydratedSetup[] = [];
  for (const entry of entries) {
    try {
      const setup = parseLspSetup(entry.text, entry.name);
      results.push({ ...setup, manualId: entry.id });
    } catch {
      // Skip entries that fail to parse
    }
  }
  return results;
}

export function removeEntry(entries: ManualSetupEntry[], id: string): ManualSetupEntry[] {
  return entries.filter((e) => e.id !== id);
}

export function restoreManualSetups(
  entries: ManualSetupEntry[],
  setSetups: (fn: (prev: CarSetup[]) => CarSetup[]) => void,
): void {
  if (entries.length === 0) {
    return;
  }
  const rehydrated = rehydrateSetups(entries);
  if (rehydrated.length > 0) {
    setSetups((prev) => [...prev, ...rehydrated]);
  }
}
