export type WatcherChange = {
  type: "appeared" | "disappeared" | "modified";
  relativePath: string;
};

const ACTIONABLE_TYPES = new Set(["appeared", "disappeared", "modified", "moved"]);

function isLsp(pathComponents: string[]): boolean {
  return pathComponents[pathComponents.length - 1]?.endsWith(".lsp") ?? false;
}

export function processRecords(records: FileSystemChangeRecord[]): WatcherChange[] {
  const changeMap = new Map<string, WatcherChange>();

  for (const record of records) {
    if (!ACTIONABLE_TYPES.has(record.type)) continue;

    if (record.type === "moved") {
      // Moved = disappeared at old path + appeared at new path
      if (record.relativePathMovedFrom && isLsp(record.relativePathMovedFrom)) {
        const oldPath = record.relativePathMovedFrom.join("/");
        changeMap.set(oldPath, { type: "disappeared", relativePath: oldPath });
      }
      if (isLsp(record.relativePathComponents)) {
        const newPath = record.relativePathComponents.join("/");
        changeMap.set(newPath, { type: "appeared", relativePath: newPath });
      }
    } else {
      if (!isLsp(record.relativePathComponents)) continue;
      const relativePath = record.relativePathComponents.join("/");
      changeMap.set(relativePath, { type: record.type, relativePath });
    }
  }

  return [...changeMap.values()];
}

export function hasLspChanges(records: FileSystemChangeRecord[]): boolean {
  return records.some((r) => {
    if (!ACTIONABLE_TYPES.has(r.type)) return false;
    if (r.type === "moved") {
      return (
        isLsp(r.relativePathComponents) ||
        (r.relativePathMovedFrom ? isLsp(r.relativePathMovedFrom) : false)
      );
    }
    return isLsp(r.relativePathComponents);
  });
}
