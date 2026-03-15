import { useCallback, useEffect, useRef, useState } from "react";
import type { EditConfig } from "./components/ComparisonTable.tsx";
import { ComparisonTable } from "./components/ComparisonTable.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { SetupBrowser } from "./components/SetupBrowser.tsx";
import { compareSetups } from "./lib/compare.ts";
import { loadExampleSetups } from "./lib/example-setups.ts";
import { writeFileHandle } from "./lib/fs-access.ts";
import type { CarSetup } from "./lib/lsp-parser.ts";
import { setupToLsp } from "./lib/lsp-writer.ts";
import { getRangeForKey, type RangeMap } from "./lib/range-mapping.ts";
import type { ScannedSetup } from "./lib/rbr-scanner.ts";
import { SECTION_RENAMES, unsanitizeValue } from "./lib/sanitize.ts";
import { buildShareUrl, clearUrlHash, hydrateFromUrl } from "./lib/url-sharing.ts";
import { useFilePicker } from "./lib/use-file-picker.ts";
import { inferSurface, useRbrDirectory } from "./lib/use-rbr-directory.ts";
import { stepValue, useSetupEditor } from "./lib/use-setup-editor.ts";

const STORAGE_KEY = "rbr-loaded-paths";

// Reverse of SECTION_RENAMES: display name → raw name
const SECTION_UNRENAMES: Record<string, string> = {};
for (const [raw, display] of Object.entries(SECTION_RENAMES)) {
  SECTION_UNRENAMES[display] = raw;
}

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
  const urlData = useRef(hydrateFromUrl());
  const [setups, setSetups] = useState<CarSetup[]>(() =>
    urlData.current.found ? urlData.current.setups : [],
  );
  const [diffsOnly, setDiffsOnly] = useState(() =>
    urlData.current.found ? urlData.current.diffsOnly : true,
  );
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  // Track which relativePaths from the sidebar are currently loaded
  const [loadedPaths, _setLoadedPaths] = useState<Set<string>>(new Set());
  const setLoadedPaths = useCallback(
    (update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      _setLoadedPaths((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        saveLoadedPaths(next);
        return next;
      });
    },
    [],
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const hasRestoredRef = useRef(false);

  const handleFilesReady = useCallback((newSetups: CarSetup[]) => {
    setSetups((prev) => [...prev, ...newSetups]);
  }, []);

  const { processFiles, triggerFilePicker, error } = useFilePicker(handleFilesReady);

  const rbr = useRbrDirectory();
  const [sidebarDismissed, setSidebarDismissed] = useState(false);

  const editor = useSetupEditor();
  const [editRanges, setEditRanges] = useState<RangeMap | null>(null);
  // Track file handles for directory-loaded setups (keyed by setup name/path)
  const fileHandles = useRef(new Map<string, FileSystemFileHandle>());

  const handleLoadExample = useCallback(() => {
    setSetups(loadExampleSetups());
  }, []);

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
        fileHandles.current.delete(path);
        setLoadedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      } else {
        // Load
        setLoadingPaths((prev) => new Set(prev).add(path));
        try {
          const [loaded] = await rbr.loadSetups([setup]);
          setSetups((prev) => [...prev, { ...loaded, name: path }]);
          fileHandles.current.set(path, setup.fileHandle);
          setLoadedPaths((prev) => new Set(prev).add(path));
        } finally {
          setLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [rbr, setLoadedPaths],
  );

  const handleDisconnect = useCallback(async () => {
    setSetups((prev) => prev.filter((s) => !loadedPaths.has(s.name)));
    for (const path of loadedPaths) {
      fileHandles.current.delete(path);
    }
    setLoadedPaths(new Set());
    setLoadingPaths(new Set());
    await rbr.forgetDirectory();
    setSidebarDismissed(true);
  }, [rbr, loadedPaths, setLoadedPaths]);

  const restoreFromLocalStorage = useCallback(async () => {
    const storedPaths = readStoredPaths();
    if (storedPaths.length === 0 || rbr.carGroups.length === 0) return;

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

    const results: CarSetup[] = [];
    const loaded = new Set<string>();
    for (const setup of toRestore) {
      try {
        const [parsed] = await rbr.loadSetups([setup]);
        results.push({ ...parsed, name: setup.relativePath });
        loaded.add(setup.relativePath);
        fileHandles.current.set(setup.relativePath, setup.fileHandle);
      } catch (e) {
        console.error(`[rbr-dir] Failed to restore ${setup.relativePath}:`, e);
      }
    }
    setSetups((prev) => [...prev, ...results]);
    setLoadedPaths(loaded);
    setLoadingPaths(new Set());
  }, [rbr, setLoadedPaths]);

  // Restore previously loaded setups after scan completes
  useEffect(() => {
    if (urlData.current.found) return;
    if (hasRestoredRef.current || rbr.carGroups.length === 0) return;
    hasRestoredRef.current = true;
    restoreFromLocalStorage();
  }, [rbr.carGroups.length, restoreFromLocalStorage]);

  const handleRemoveSetup = useCallback(
    (index: number) => {
      setSetups((prev) => {
        const removed = prev[index];
        if (removed) {
          fileHandles.current.delete(removed.name);
          setLoadedPaths((lp) => {
            const next = new Set(lp);
            next.delete(removed.name);
            return next;
          });
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    [setLoadedPaths],
  );

  const handleReorderSetup = useCallback((fromIndex: number, toIndex: number) => {
    setSetups((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleSaveSetup = useCallback(
    (index: number) => {
      const edited = editor.getEditedSetup();
      const allSetups = edited ? [...setups, edited] : setups;
      const setup = allSetups[index];
      if (!setup) return;
      const lspText = setupToLsp(setup);
      const blob = new Blob([lspText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileName = setup.name.split("/").pop() ?? setup.name;
      a.download = fileName.endsWith(".lsp") ? fileName : `${fileName}.lsp`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [setups, editor],
  );

  const handleStartEdit = useCallback(
    async (index: number) => {
      if (editor.editState) {
        const hasEdits = editor.editState.edits.size > 0;
        if (hasEdits && !window.confirm("Discard current edits?")) {
          return;
        }
      }
      const setup = setups[index];
      editor.startEdit(setup);
      setEditRanges(null);

      // Try to load range data for this setup
      const fileName = setup.name.split("/").pop() ?? setup.name;
      const surface = inferSurface(fileName);
      if (!surface) return;

      // Find the car group that owns this setup path
      const group = rbr.carGroups.find((g) => g.setups.some((s) => s.relativePath === setup.name));
      if (!group) return;

      const ranges = await rbr.loadRanges(group.carName, surface);
      if (ranges) {
        setEditRanges(ranges);
      }
    },
    [editor, setups, rbr],
  );

  const handleStep = useCallback(
    (displaySection: string, key: string, direction: 1 | -1, fine: boolean) => {
      const rawSection = SECTION_UNRENAMES[displaySection] ?? displaySection;
      const range = editRanges ? getRangeForKey(editRanges, rawSection, key) : undefined;

      editor.updateValueWith(rawSection, key, (currentRaw) => {
        if (range) return stepValue(currentRaw, direction, range, fine);
        // No range: derive step from max decimal precision across all setups
        let maxDecimals = 0;
        for (const s of setups) {
          const v = s.sections[rawSection]?.values[key];
          if (typeof v === "number") {
            const str = String(v);
            const d = str.includes(".") ? str.split(".")[1].length : 0;
            if (d > maxDecimals) maxDecimals = d;
          }
        }
        const step = 10 ** -maxDecimals;
        const delta = fine ? step / 10 : step;
        const raw = currentRaw + direction * delta;
        // Round to step precision to avoid floating-point drift
        const factor = 10 ** (maxDecimals + (fine ? 1 : 0));
        return Math.round(raw * factor) / factor;
      });
    },
    [editRanges, editor, setups],
  );

  const handleCellEdit = useCallback(
    (displaySection: string, key: string, displayValue: string) => {
      const num = parseFloat(displayValue);
      if (Number.isNaN(num)) return;
      const rawValue = unsanitizeValue(key, num);
      // Reverse section rename: display name → raw name
      const rawSection = SECTION_UNRENAMES[displaySection] ?? displaySection;
      editor.updateValue(rawSection, key, rawValue);
    },
    [editor],
  );

  const handleCellReset = useCallback(
    (displaySection: string, key: string) => {
      const rawSection = SECTION_UNRENAMES[displaySection] ?? displaySection;
      editor.resetValue(rawSection, key);
    },
    [editor],
  );

  const handleToggleDiffMode = useCallback(() => {
    if (!editor.editState) return;
    editor.setDiffMode(
      editor.editState.diffMode === "vs-reference" ? "vs-original" : "vs-reference",
    );
  }, [editor]);

  const handleSaveEdit = useCallback(() => {
    const edited = editor.getEditedSetup();
    if (!edited) return;
    const lspText = setupToLsp(edited);
    const blob = new Blob([lspText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = edited.name.split("/").pop() ?? edited.name;
    a.download = fileName.endsWith(".lsp") ? fileName : `${fileName}.lsp`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  const handleOverwriteEdit = useCallback(
    async (fileName: string) => {
      const edited = editor.getEditedSetup();
      if (!edited) return;
      const sourceName = editor.editState?.sourceName ?? "";
      const originalHandle = fileHandles.current.get(sourceName);
      if (!originalHandle) return;

      const lspText = setupToLsp(edited);
      const originalFileName = sourceName.split("/").pop() ?? "";

      try {
        if (fileName === originalFileName) {
          // Overwrite original
          await writeFileHandle(originalHandle, lspText);
        } else {
          // Save as new file in the same directory
          if (!rbr.handle) return;
          const pathParts = sourceName.split("/");
          pathParts.pop(); // remove filename
          let dir: FileSystemDirectoryHandle = rbr.handle;
          for (const part of pathParts) {
            dir = await dir.getDirectoryHandle(part);
          }
          const newHandle = await dir.getFileHandle(fileName, { create: true });
          await writeFileHandle(newHandle, lspText);
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to write file");
      }
    },
    [editor, rbr.handle],
  );

  const handleShare = useCallback(async () => {
    const result = buildShareUrl(setups, diffsOnly);
    if (!result.ok) {
      setShareStatus(result.error);
    } else {
      try {
        await navigator.clipboard.writeText(result.url);
        setShareStatus("Link copied!");
      } catch {
        setShareStatus("Failed to copy");
      }
    }
    const id = setTimeout(() => setShareStatus(null), 3000);
    return () => clearTimeout(id);
  }, [setups, diffsOnly]);

  // Build the comparison, including the edited setup as the last column if editing
  const editedSetup = editor.getEditedSetup();
  const setupsForComparison = editedSetup ? [...setups, editedSetup] : setups;
  const comparison = setupsForComparison.length >= 1 ? compareSetups(setupsForComparison) : null;

  const setupNames = setupsForComparison.map((s) => s.name.split("/").pop() ?? s.name);

  // Build editConfig for ComparisonTable
  const handleDiscardEdit = useCallback(() => {
    editor.discardEdit();
    setEditRanges(null);
  }, [editor]);

  const editConfig: EditConfig | undefined = editor.editState
    ? {
        columnIndex: setups.length, // always last column
        sourceIndex: setups.findIndex((s) => s.name === editor.editState?.sourceName),
        sourceName: editor.editState.sourceName,
        edits: editor.editState.edits,
        diffMode: editor.editState.diffMode,
        rangeMap: editRanges,
        onCellEdit: handleCellEdit,
        onCellReset: handleCellReset,
        onStep: handleStep,
        onToggleDiffMode: handleToggleDiffMode,
        onDiscard: handleDiscardEdit,
        onSave: handleSaveEdit,
        canOverwrite: fileHandles.current.has(editor.editState?.sourceName ?? ""),
        onOverwrite: handleOverwriteEdit,
      }
    : undefined;

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
        onLoadExample={handleLoadExample}
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
                type="button"
                onClick={handleOpenDirectory}
                className="text-xs text-text-muted hover:text-text-secondary cursor-pointer uppercase tracking-wider"
              >
                Open RBR folder
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (urlData.current.found) {
                  setSetups([]);
                  clearUrlHash();
                  urlData.current = { found: false };
                  hasRestoredRef.current = true;
                  restoreFromLocalStorage();
                } else {
                  if (!confirm("Remove all loaded setups?")) return;
                  setSetups([]);
                  setLoadedPaths(new Set());
                  clearUrlHash();
                }
              }}
              className="text-xs text-text-muted hover:text-text-secondary cursor-pointer uppercase tracking-wider"
            >
              {urlData.current.found ? "Dismiss shared" : "Clear all"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={setups.length === 0}
              title="Copy a shareable link to this comparison"
              className={`text-xs uppercase tracking-wider ${
                setups.length === 0
                  ? "text-text-muted/40 cursor-not-allowed"
                  : shareStatus
                    ? shareStatus.startsWith("Link")
                      ? "text-diff-positive cursor-pointer"
                      : "text-diff-negative cursor-pointer"
                    : "text-blue-400 hover:text-blue-300 cursor-pointer"
              }`}
            >
              {shareStatus ?? "Copy share link"}
            </button>
            <button
              type="button"
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
                setupNames={setupNames}
                onRemoveSetup={handleRemoveSetup}
                onSaveSetup={handleSaveSetup}
                onReorderSetup={handleReorderSetup}
                diffsOnly={diffsOnly && setups.length > 1}
                editConfig={editConfig}
                onStartEdit={handleStartEdit}
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
