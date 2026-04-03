import { useEffect, useRef } from "react";
import { type CarGroup, scanRbrDirectory } from "./rbr-scanner.ts";
import { hasLspChanges, processRecords, type WatcherChange } from "./watcher-records.ts";

export type DirectoryWatcherOptions = {
  directoryHandle: FileSystemDirectoryHandle | null;
  enabled: boolean;
  debounceMs?: number;
  onChanges: (changes: WatcherChange[], newGroups: CarGroup[]) => void;
};

const DEFAULT_DEBOUNCE_MS = 500;

export function useDirectoryWatcher(options: DirectoryWatcherOptions): void {
  const { directoryHandle, enabled, debounceMs = DEFAULT_DEBOUNCE_MS, onChanges } = options;
  const onChangesRef = useRef(onChanges);
  onChangesRef.current = onChanges;

  useEffect(() => {
    if (!enabled || !directoryHandle) {
      return;
    }
    if (typeof FileSystemObserver === "undefined") {
      return;
    }

    // Capture handle for use inside closures (narrowed from the guard above)
    const handle = directoryHandle;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let accumulatedRecords: FileSystemChangeRecord[] = [];
    let isRescanning = false;
    let disposed = false;

    const observer = new FileSystemObserver((records: FileSystemChangeRecord[]) => {
      if (disposed) {
        return;
      }
      accumulatedRecords.push(...records);

      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void flush();
      }, debounceMs);
    });

    async function flush() {
      if (disposed || isRescanning) {
        return;
      }
      const records = accumulatedRecords;
      accumulatedRecords = [];

      if (!hasLspChanges(records)) {
        return;
      }

      isRescanning = true;
      try {
        const newGroups = await scanRbrDirectory(handle);
        if (disposed) {
          return;
        }
        const changes = processRecords(records);
        onChangesRef.current(changes, newGroups);
      } catch (e) {
        console.error("[directory-watcher] Rescan failed:", e);
      } finally {
        isRescanning = false;
      }
    }

    observer.observe(handle, { recursive: true });

    return () => {
      disposed = true;
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      observer.disconnect();
    };
  }, [directoryHandle, enabled, debounceMs]);
}
