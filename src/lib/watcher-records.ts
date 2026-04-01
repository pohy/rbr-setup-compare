import { exhaustiveCheck } from "./exhaustive-check.ts";

export type WatcherChange = {
  type: "appeared" | "disappeared" | "modified";
  relativePath: string;
};

function isLsp(pathComponents: string[]): boolean {
  return pathComponents[pathComponents.length - 1]?.endsWith(".lsp") ?? false;
}

export function processRecords(records: FileSystemChangeRecord[]): WatcherChange[] {
  const changeMap = new Map<string, WatcherChange>();

  for (const record of records) {
    switch (record.type) {
      case "appeared":
      case "disappeared":
      case "modified": {
        if (!isLsp(record.relativePathComponents)) continue;
        const relativePath = record.relativePathComponents.join("/");
        changeMap.set(relativePath, { type: record.type, relativePath });
        break;
      }
      case "moved": {
        if (record.relativePathMovedFrom && isLsp(record.relativePathMovedFrom)) {
          const oldPath = record.relativePathMovedFrom.join("/");
          changeMap.set(oldPath, { type: "disappeared", relativePath: oldPath });
        }
        if (isLsp(record.relativePathComponents)) {
          const newPath = record.relativePathComponents.join("/");
          changeMap.set(newPath, { type: "appeared", relativePath: newPath });
        }
        break;
      }
      case "unknown":
      case "errored":
        continue;
      default:
        exhaustiveCheck(record.type);
    }
  }

  return [...changeMap.values()];
}

export function hasLspChanges(records: FileSystemChangeRecord[]): boolean {
  return records.some((r) => {
    switch (r.type) {
      case "appeared":
      case "disappeared":
      case "modified":
        return isLsp(r.relativePathComponents);
      case "moved":
        return (
          isLsp(r.relativePathComponents) ||
          (r.relativePathMovedFrom ? isLsp(r.relativePathMovedFrom) : false)
        );
      case "unknown":
      case "errored":
        return false;
      default:
        return exhaustiveCheck(r.type);
    }
  });
}
