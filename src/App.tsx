import { useState, useCallback, useEffect, useRef } from "react";
import type { CarSetup } from "./lib/lsp-parser.ts";
import type { ScannedSetup } from "./lib/rbr-scanner.ts";
import { compareSetups } from "./lib/compare.ts";
import { useFilePicker } from "./lib/use-file-picker.ts";
import { useRbrDirectory } from "./lib/use-rbr-directory.ts";
import { DropZone } from "./components/DropZone.tsx";
import { ComparisonTable } from "./components/ComparisonTable.tsx";
import { SetupBrowser } from "./components/SetupBrowser.tsx";

const STORAGE_KEY = "rbr-loaded-paths";

function saveLoadedPaths(paths: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...paths]));
  } catch {
    // storage full or unavailable
  }
}

function readStoredPaths(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function App() {
  const [setups, setSetups] = useState<CarSetup[]>([]);
  const [diffsOnly, setDiffsOnly] = useState(true);
  // Track which relativePaths from the sidebar are currently loaded
  const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const hasRestoredRef = useRef(false);

  const handleFilesReady = useCallback((newSetups: CarSetup[]) => {
    setSetups((prev) => [...prev, ...newSetups]);
  }, []);

  const { processFiles, triggerFilePicker, error } =
    useFilePicker(handleFilesReady);

  const rbr = useRbrDirectory();
  const [sidebarDismissed, setSidebarDismissed] = useState(false);

  const handleOpenDirectory = useCallback(async () => {
    if (rbr.hasStoredHandle) {
      await rbr.reopenDirectory();
    } else {
      await rbr.pickDirectory();
    }
    setSidebarDismissed(false);
  }, [rbr]);

  const handleToggleSetup = useCallback(
    async (setup: ScannedSetup, isLoaded: boolean) => {
      const path = setup.relativePath;
      if (isLoaded) {
        // Remove
        setSetups((prev) => prev.filter((s) => s.name !== path));
        setLoadedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          saveLoadedPaths(next);
          return next;
        });
      } else {
        // Load
        setLoadingPaths((prev) => new Set(prev).add(path));
        try {
          const [loaded] = await rbr.loadSetups([setup]);
          setSetups((prev) => [...prev, { ...loaded, name: path }]);
          setLoadedPaths((prev) => {
            const next = new Set(prev).add(path);
            saveLoadedPaths(next);
            return next;
          });
        } finally {
          setLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [rbr],
  );

  const handleDisconnect = useCallback(async () => {
    setSetups((prev) => prev.filter((s) => !loadedPaths.has(s.name)));
    setLoadedPaths(new Set());
    setLoadingPaths(new Set());
    saveLoadedPaths(new Set());
    await rbr.forgetDirectory();
    setSidebarDismissed(true);
  }, [rbr, loadedPaths]);

  // Restore previously loaded setups after scan completes
  useEffect(() => {
    if (hasRestoredRef.current || rbr.carGroups.length === 0) return;
    hasRestoredRef.current = true;

    const storedPaths = readStoredPaths();
    if (storedPaths.length === 0) return;

    // Find matching ScannedSetup objects from the scan results
    const setupsByPath = new Map<string, ScannedSetup>();
    for (const group of rbr.carGroups) {
      for (const s of group.setups) {
        setupsByPath.set(s.relativePath, s);
      }
    }

    const toRestore = storedPaths
      .map((p) => setupsByPath.get(p))
      .filter((s): s is ScannedSetup => s !== undefined);

    if (toRestore.length === 0) return;

    const paths = toRestore.map((s) => s.relativePath);
    setLoadingPaths(new Set(paths));

    (async () => {
      const results: CarSetup[] = [];
      const loaded = new Set<string>();
      for (const setup of toRestore) {
        try {
          const [parsed] = await rbr.loadSetups([setup]);
          results.push({ ...parsed, name: setup.relativePath });
          loaded.add(setup.relativePath);
        } catch (e) {
          console.error(
            `[rbr-dir] Failed to restore ${setup.relativePath}:`,
            e,
          );
        }
      }
      setSetups((prev) => [...prev, ...results]);
      setLoadedPaths(loaded);
      saveLoadedPaths(loaded);
      setLoadingPaths(new Set());
    })();
  }, [rbr]);

  const handleRemoveSetup = useCallback((index: number) => {
    setSetups((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleReorderSetup = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSetups((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [],
  );

  const comparison = setups.length >= 1 ? compareSetups(setups) : null;
  const showSidebar = rbr.carGroups.length > 0 && !sidebarDismissed;
  const hasContent = setups.length > 0 || showSidebar;

  // Landing screen: no setups loaded AND no sidebar to show
  if (!hasContent) {
    return (
      <DropZone
        hasFiles={false}
        onFilesSelected={processFiles}
        onBrowse={triggerFilePicker}
        error={error || rbr.error}
        onOpenDirectory={handleOpenDirectory}
        hasStoredHandle={rbr.hasStoredHandle}
        isDirectorySupported={rbr.isSupported}
      />
    );
  }

  return (
    <div className="h-screen flex bg-base text-text-primary">
      <DropZone
        hasFiles={true}
        onFilesSelected={processFiles}
        onBrowse={triggerFilePicker}
        error={null}
      />

      {/* Sidebar */}
      {showSidebar && (
        <SetupBrowser
          carGroups={rbr.carGroups}
          isScanning={rbr.isScanning}
          error={rbr.error}
          loadedPaths={loadedPaths}
          loadingPaths={loadingPaths}
          onToggleSetup={handleToggleSetup}
          onChangeFolder={async () => {
            await rbr.pickDirectory();
          }}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-surface border-b border-border">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium select-none">
            RBR Setup Compare
          </span>

          <div className="flex items-center gap-4">
            <span className="text-xs text-text-secondary">
              {setups.length} file{setups.length !== 1 ? "s" : ""}
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={diffsOnly}
                onChange={(e) => setDiffsOnly(e.target.checked)}
                className="cursor-pointer accent-accent"
              />
              <span className="text-xs text-text-secondary uppercase tracking-wider">
                Diffs only
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            {rbr.isSupported && !showSidebar && (
              <button
                onClick={handleOpenDirectory}
                className="text-xs text-text-muted hover:text-text-secondary cursor-pointer uppercase tracking-wider"
              >
                Open RBR folder
              </button>
            )}
            <button
              onClick={() => setSetups([])}
              className="text-xs text-text-muted hover:text-text-secondary cursor-pointer uppercase tracking-wider"
            >
              Clear all
            </button>
            <button
              onClick={triggerFilePicker}
              className="text-xs font-medium text-accent hover:text-text-primary cursor-pointer uppercase tracking-wider"
            >
              + Add files
            </button>
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="px-4 py-1.5 bg-diff-negative/10 border-b border-diff-negative/30 text-diff-negative text-xs">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 min-h-0 p-4">
        <div className="h-full overflow-auto">
          {comparison ? (
            <ComparisonTable
              result={comparison}
              setupNames={setups.map((s) => s.name.split("/").pop()!)}
              onRemoveSetup={handleRemoveSetup}
              onReorderSetup={handleReorderSetup}
              diffsOnly={diffsOnly && setups.length > 1}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs uppercase tracking-wider text-text-muted">
                Check setups in the sidebar to compare
              </p>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default App;
