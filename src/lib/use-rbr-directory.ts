import { useCallback, useEffect, useState } from "react";
import {
  clearDirectoryHandle,
  loadDirectoryHandle,
  saveDirectoryHandle,
} from "./directory-handle-store.ts";
import {
  checkPermission,
  isFileSystemAccessSupported,
  pickDirectory,
  readFileHandle,
  verifyPermission,
} from "./fs-access.ts";
import { type CarSetup, parseLspSetup } from "./lsp-parser.ts";
import { type CarGroup, type ScannedSetup, scanRbrDirectory } from "./rbr-scanner.ts";
import { sanitizeSetup } from "./sanitize.ts";

export type { CarGroup, ScannedSetup };

export function useRbrDirectory() {
  const isSupported = isFileSystemAccessSupported();
  const [hasStoredHandle, setHasStoredHandle] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [carGroups, setCarGroups] = useState<CarGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const scan = useCallback(async (dirHandle: FileSystemDirectoryHandle) => {
    console.log(`[rbr-dir] Scanning directory: "${dirHandle.name}"`);
    setIsScanning(true);
    setError(null);
    try {
      const groups = await scanRbrDirectory(dirHandle);
      console.log(
        `[rbr-dir] Scan succeeded: ${groups.length} car groups, ${groups.reduce((n, g) => n + g.setups.length, 0)} total setups`,
      );
      setCarGroups(groups);
      setHandle(dirHandle);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[rbr-dir] Scan failed:`, msg);
      setError(msg);
      setCarGroups([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // On mount: if stored handle exists and permission already granted, auto-scan
  useEffect(() => {
    if (!isSupported) return;
    loadDirectoryHandle().then(async (h) => {
      if (!h) return;
      setHasStoredHandle(true);
      setHandle(h);
      const granted = await checkPermission(h);
      if (granted) {
        console.log("[rbr-dir] Stored handle has permission, auto-scanning");
        await scan(h);
      } else {
        console.log("[rbr-dir] Stored handle needs re-authorization");
      }
    });
  }, [isSupported, scan]);

  const pickAndScan = useCallback(async () => {
    try {
      const dirHandle = await pickDirectory();
      setError(null);
      await scan(dirHandle);
      // Only persist if scan succeeded (carGroups will be set)
      await saveDirectoryHandle(dirHandle);
      setHasStoredHandle(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [scan]);

  const reopenDirectory = useCallback(async () => {
    const stored = await loadDirectoryHandle();
    if (!stored) {
      setHasStoredHandle(false);
      return;
    }
    const granted = await verifyPermission(stored);
    if (!granted) {
      await clearDirectoryHandle();
      setHasStoredHandle(false);
      setHandle(null);
      return;
    }
    await scan(stored);
  }, [scan]);

  const loadSetups = useCallback(async (selected: ScannedSetup[]): Promise<CarSetup[]> => {
    const results: CarSetup[] = [];
    for (const item of selected) {
      const text = await readFileHandle(item.fileHandle);
      const setup = parseLspSetup(text, item.fileName);
      results.push(sanitizeSetup(setup));
    }
    return results;
  }, []);

  const forgetDirectory = useCallback(async () => {
    await clearDirectoryHandle();
    setHasStoredHandle(false);
    setHandle(null);
    setCarGroups([]);
    setError(null);
  }, []);

  return {
    isSupported,
    hasStoredHandle,
    isScanning,
    carGroups,
    error,
    handle,
    pickDirectory: pickAndScan,
    reopenDirectory,
    loadSetups,
    forgetDirectory,
  };
}
