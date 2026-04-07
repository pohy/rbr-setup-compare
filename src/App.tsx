import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditConfig } from "./components/ComparisonTable.tsx";
import { ComparisonTable } from "./components/ComparisonTable.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { SetupBrowser } from "./components/SetupBrowser.tsx";
import { compareSetups } from "./lib/compare.ts";
import {
  getClearAllConfirmMessage,
  getUncheckConfirmMessage,
  promptSaveAs,
} from "./lib/confirm-messages.ts";
import { loadExampleSetups } from "./lib/example-setups.ts";
import { writeFileHandle } from "./lib/fs-access.ts";
import type { CarSetup } from "./lib/lsp-parser.ts";
import { setupToLsp } from "./lib/lsp-writer.ts";
import { createManualEntry, removeEntry, restoreManualSetups } from "./lib/manual-setup-store.ts";
import { getRangeForKey, type RangeMap } from "./lib/range-mapping.ts";
import type { CarGroup, ScannedSetup } from "./lib/rbr-scanner.ts";
import { SECTION_RENAMES, unsanitizeValue } from "./lib/sanitize.ts";
import { isOverwritable, savedGamesCarDir } from "./lib/setup-permissions.ts";
import { buildShareUrl, clearUrlHash, hydrateFromUrl } from "./lib/url-sharing.ts";
import { useDirectoryWatcher } from "./lib/use-directory-watcher.ts";
import { type ParsedFile, useFilePicker } from "./lib/use-file-picker.ts";
import { usePersistentState } from "./lib/use-persistent-state.ts";
import { inferSurface, useRbrDirectory } from "./lib/use-rbr-directory.ts";
import { stepValue, useSetupEditor } from "./lib/use-setup-editor.ts";
import type { WatcherChange } from "./lib/watcher-records.ts";

// Reverse of SECTION_RENAMES: display name → raw name
const SECTION_UNRENAMES: Record<string, string> = {};
for (const [raw, display] of Object.entries(SECTION_RENAMES)) {
  SECTION_UNRENAMES[display] = raw;
}

function App() {
  const urlData = useRef(hydrateFromUrl());
  const [isViewingShared, setIsViewingShared] = useState(urlData.current.found);
  const [sharedSetups, setSharedSetups] = useState<CarSetup[]>(() =>
    urlData.current.found ? urlData.current.setups : [],
  );
  const [setups, setSetups] = useState<CarSetup[]>([]);
  const [diffsOnly, setDiffsOnly] = usePersistentState("rbr-diffs-only", true);
  const [showLspLabels, setShowLspLabels] = usePersistentState("rbr-lsp-labels", false);
  // URL-shared data overrides persisted preference (one-time)
  const hasAppliedSharedDiffsRef = useRef(false);
  if (!hasAppliedSharedDiffsRef.current && urlData.current.found) {
    hasAppliedSharedDiffsRef.current = true;
    if (urlData.current.diffsOnly !== diffsOnly) {
      setDiffsOnly(urlData.current.diffsOnly);
    }
  }
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  // Track which relativePaths from the sidebar are currently loaded
  const [loadedPathsArr, setLoadedPathsArr] = usePersistentState("rbr-loaded-paths", []);
  const loadedPaths = useMemo(() => new Set(loadedPathsArr), [loadedPathsArr]);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const hasRestoredRef = useRef(false);
  const hasRestoredManualRef = useRef(false);
  const [manualEntries, setManualEntries] = usePersistentState("rbr-manual-setups", []);

  const handleFilesReady = useCallback(
    (files: ParsedFile[]) => {
      const entries = files.map((f) => createManualEntry(f.setup.name, f.text));
      setManualEntries((prev) => [...prev, ...entries]);
      const newSetups = files.map((f, i) => ({ ...f.setup, manualId: entries[i].id }));
      setSetups((prev) => [...prev, ...newSetups]);
    },
    [setManualEntries],
  );

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
    if (manualEntries.length > 0) {
      const ok = window.confirm(
        `You have ${manualEntries.length} manually loaded setup${manualEntries.length > 1 ? "s" : ""}. Connecting a directory will replace them. Continue?`,
      );
      if (!ok) {
        return;
      }
      setManualEntries([]);
      setSetups((prev) => prev.filter((s) => !(s as CarSetup & { manualId?: string }).manualId));
    }
    if (rbr.hasStoredHandle) {
      await rbr.reopenDirectory();
    } else {
      await rbr.pickDirectory();
    }
    setSidebarDismissed(false);
  }, [rbr, manualEntries.length, setManualEntries]);

  const handleToggleSetup = useCallback(
    async (setup: ScannedSetup, isLoaded: boolean) => {
      const path = setup.relativePath;
      if (isLoaded) {
        // Check if unchecking the currently-edited setup with pending edits
        const confirmMsg = getUncheckConfirmMessage(
          editor.editState?.sourceName,
          (editor.editState?.edits.size ?? 0) > 0,
          path,
        );
        if (confirmMsg && !window.confirm(confirmMsg)) {
          return;
        }
        // Discard edit if unchecking the edited setup (even without pending edits)
        if (editor.editState?.sourceName === path) {
          editor.discardEdit();
        }
        // Remove
        setSetups((prev) => prev.filter((s) => s.name !== path));
        fileHandles.current.delete(path);
        setLoadedPathsArr((prev) => prev.filter((p) => p !== path));
      } else {
        // Load
        setLoadingPaths((prev) => new Set(prev).add(path));
        try {
          const [loaded] = await rbr.loadSetups([setup]);
          setSetups((prev) => [...prev, { ...loaded, name: path }]);
          fileHandles.current.set(path, setup.fileHandle);
          setLoadedPathsArr((prev) => [...prev, path]);
        } finally {
          setLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [rbr, setLoadedPathsArr, editor],
  );

  const handleDisconnect = useCallback(async () => {
    setSetups((prev) => prev.filter((s) => !loadedPaths.has(s.name)));
    for (const path of loadedPaths) {
      fileHandles.current.delete(path);
    }
    setLoadedPathsArr([]);
    setLoadingPaths(new Set());
    await rbr.forgetDirectory();
    setSidebarDismissed(true);
  }, [rbr, loadedPaths, setLoadedPathsArr]);

  const restoreFromLocalStorage = useCallback(async () => {
    if (loadedPathsArr.length === 0 || rbr.carGroups.length === 0) {
      return;
    }

    const setupsByPath = new Map<string, ScannedSetup>();
    for (const group of rbr.carGroups) {
      for (const s of group.setups) {
        setupsByPath.set(s.relativePath, s);
      }
    }

    const toRestore = loadedPathsArr
      .map((p) => setupsByPath.get(p))
      .filter((s): s is ScannedSetup => s !== undefined);

    if (toRestore.length === 0) {
      return;
    }

    const paths = toRestore.map((s) => s.relativePath);
    setLoadingPaths(new Set(paths));

    const results: CarSetup[] = [];
    const restoredPaths: string[] = [];
    for (const setup of toRestore) {
      try {
        const [parsed] = await rbr.loadSetups([setup]);
        results.push({ ...parsed, name: setup.relativePath });
        restoredPaths.push(setup.relativePath);
        fileHandles.current.set(setup.relativePath, setup.fileHandle);
      } catch (e) {
        console.error(`[rbr-dir] Failed to restore ${setup.relativePath}:`, e);
      }
    }
    setSetups((prev) => [...prev, ...results]);
    setLoadedPathsArr(restoredPaths);
    setLoadingPaths(new Set());
  }, [rbr, loadedPathsArr, setLoadedPathsArr]);

  // Restore previously loaded setups after scan completes
  useEffect(() => {
    if (hasRestoredRef.current || rbr.carGroups.length === 0) {
      return;
    }
    hasRestoredRef.current = true;
    hasRestoredManualRef.current = true; // FS path takes precedence
    restoreFromLocalStorage();
  }, [rbr.carGroups.length, restoreFromLocalStorage]);

  // Restore manually loaded setups when no FS API directory is available
  useEffect(() => {
    if (hasRestoredManualRef.current || !rbr.isReady) {
      return;
    }
    if (rbr.hasStoredHandle) {
      return; // FS path will handle restoration
    }
    hasRestoredManualRef.current = true;
    restoreManualSetups(manualEntries, setSetups);
  }, [rbr.isReady, rbr.hasStoredHandle, manualEntries]);

  // --- Directory watcher: auto-detect external file changes ---
  const handleDirectoryChanges = useCallback(
    async (changes: WatcherChange[], newGroups: CarGroup[]) => {
      rbr.updateCarGroups(newGroups);

      const disappeared = changes.filter((c) => c.type === "disappeared");
      const modified = changes.filter((c) => c.type === "modified");

      // Remove deleted setups
      for (const change of disappeared) {
        if (loadedPaths.has(change.relativePath)) {
          // Discard edit if the deleted file is the one being edited
          if (editor.editState?.sourceName === change.relativePath) {
            editor.discardEdit();
          }
          setSetups((prev) => prev.filter((s) => s.name !== change.relativePath));
          fileHandles.current.delete(change.relativePath);
          setLoadedPathsArr((prev) => prev.filter((p) => p !== change.relativePath));
        }
      }

      // Reload modified loaded setups
      for (const change of modified) {
        if (!loadedPaths.has(change.relativePath)) {
          continue;
        }

        // Find the ScannedSetup in the new groups
        let scanned: ScannedSetup | undefined;
        for (const group of newGroups) {
          scanned = group.setups.find((s) => s.relativePath === change.relativePath);
          if (scanned) {
            break;
          }
        }
        if (!scanned) {
          continue;
        }

        try {
          const [reloaded] = await rbr.loadSetups([scanned]);
          const namedSetup = { ...reloaded, name: change.relativePath };
          setSetups((prev) => prev.map((s) => (s.name === change.relativePath ? namedSetup : s)));
          fileHandles.current.set(change.relativePath, scanned.fileHandle);

          // Update editor source if the modified file is being edited
          if (editor.editState?.sourceName === change.relativePath) {
            editor.updateSource(namedSetup);
          }
        } catch (e) {
          console.error(`[directory-watcher] Failed to reload ${change.relativePath}:`, e);
        }
      }
    },
    [rbr, loadedPaths, editor, setLoadedPathsArr],
  );

  useDirectoryWatcher({
    directoryHandle: rbr.handle,
    enabled: !rbr.isScanning && rbr.carGroups.length > 0,
    onChanges: handleDirectoryChanges,
  });

  const handleRemoveSetup = useCallback(
    (index: number) => {
      setSetups((prev) => {
        const removed = prev[index] as CarSetup & { manualId?: string };
        if (removed) {
          fileHandles.current.delete(removed.name);
          setLoadedPathsArr((lp) => lp.filter((p) => p !== removed.name));
          const { manualId } = removed;
          if (manualId) {
            setManualEntries((entries) => removeEntry(entries, manualId));
          }
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    [setLoadedPathsArr, setManualEntries],
  );

  const handleReorderSetup = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSetups((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        setLoadedPathsArr(next.filter((s) => loadedPaths.has(s.name)).map((s) => s.name));
        return next;
      });
    },
    [setLoadedPathsArr, loadedPaths],
  );

  const handleSaveSetup = useCallback(
    (index: number) => {
      const edited = editor.getEditedSetup();
      const allSetups = edited ? [...setups, edited] : setups;
      const setup = allSetups[index];
      if (!setup) {
        return;
      }
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

  const loadRangesForSetup = useCallback(
    async (setupName: string) => {
      const fileName = setupName.split("/").pop() ?? setupName;
      const surface = inferSurface(fileName);
      if (!surface) {
        return null;
      }

      const group = rbr.carGroups.find((g) => g.setups.some((s) => s.relativePath === setupName));
      if (!group) {
        return null;
      }

      return rbr.loadRanges(group.carName, surface);
    },
    [rbr],
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

      const ranges = await loadRangesForSetup(setup.name);
      if (ranges) {
        setEditRanges(ranges);
      }
    },
    [editor, setups, loadRangesForSetup],
  );

  // Restore edit ranges when edit state is restored from localStorage but ranges aren't loaded yet
  useEffect(() => {
    if (!editor.editState || editRanges) {
      return;
    }
    let cancelled = false;
    loadRangesForSetup(editor.editState.sourceName).then((ranges) => {
      if (!cancelled && ranges) {
        setEditRanges(ranges);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [editor.editState, editRanges, loadRangesForSetup]);

  const handleStep = useCallback(
    (displaySection: string, key: string, direction: 1 | -1, fine: boolean) => {
      const rawSection = SECTION_UNRENAMES[displaySection] ?? displaySection;
      const range = editRanges ? getRangeForKey(editRanges, rawSection, key) : undefined;

      editor.updateValueWith(rawSection, key, (currentRaw) => {
        if (range) {
          return stepValue(currentRaw, direction, range, fine);
        }
        // No range: derive step from max decimal precision across all setups
        let maxDecimals = 0;
        for (const s of setups) {
          const v = s.sections[rawSection]?.values[key];
          if (typeof v === "number") {
            const str = String(v);
            const d = str.includes(".") ? str.split(".")[1].length : 0;
            if (d > maxDecimals) {
              maxDecimals = d;
            }
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
      if (Number.isNaN(num)) {
        return;
      }
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
    if (!editor.editState) {
      return;
    }
    editor.setDiffMode(
      editor.editState.diffMode === "vs-reference" ? "vs-original" : "vs-reference",
    );
  }, [editor]);

  const handleSaveEdit = useCallback(() => {
    const edited = editor.getEditedSetup();
    if (!edited) {
      return;
    }
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

  const handleOverwriteEdit = useCallback(async () => {
    const edited = editor.getEditedSetup();
    if (!edited) {
      return;
    }
    const sourceName = editor.editState?.sourceName ?? "";
    if (!isOverwritable(sourceName)) {
      return;
    }
    const originalHandle = fileHandles.current.get(sourceName);
    if (!originalHandle) {
      return;
    }
    try {
      await writeFileHandle(originalHandle, setupToLsp(edited));
      editor.bakeEdits();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to write file");
    }
  }, [editor]);

  const handleRenameAndSave = useCallback(async () => {
    const edited = editor.getEditedSetup();
    if (!edited) {
      return;
    }
    const sourceName = editor.editState?.sourceName ?? "";
    if (!isOverwritable(sourceName) || !rbr.handle) {
      return;
    }

    try {
      const pathParts = sourceName.split("/");
      pathParts.pop(); // remove filename
      let dir: FileSystemDirectoryHandle = rbr.handle;
      for (const part of pathParts) {
        dir = await dir.getDirectoryHandle(part);
      }
      const defaultName = sourceName.split("/").pop() ?? sourceName;

      const fileName = await promptSaveAs("Save to RBR folder as:", defaultName, {
        prompt: (msg, def) => window.prompt(msg, def),
        confirm: (msg) => window.confirm(msg),
        fileExists: async (name) => {
          try {
            await dir.getFileHandle(name);
            return true;
          } catch {
            return false;
          }
        },
      });
      if (!fileName) {
        return;
      }

      const newHandle = await dir.getFileHandle(fileName, { create: true });
      await writeFileHandle(newHandle, setupToLsp(edited));
      editor.bakeEdits();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to write file");
    }
  }, [editor, rbr.handle]);

  const handleSaveToSavedGames = useCallback(async () => {
    const edited = editor.getEditedSetup();
    if (!edited) {
      return;
    }
    const sourceName = editor.editState?.sourceName ?? "";
    const carDir = savedGamesCarDir(sourceName);
    if (!carDir || !rbr.handle) {
      return;
    }
    const defaultName = sourceName.split("/").pop() ?? sourceName;

    try {
      const savedGamesDir = await rbr.handle.getDirectoryHandle("SavedGames", { create: true });
      const carDirHandle = await savedGamesDir.getDirectoryHandle(carDir, { create: true });

      const fileName = await promptSaveAs("Save to SavedGames as:", defaultName, {
        prompt: (msg, def) => window.prompt(msg, def),
        confirm: (msg) => window.confirm(msg),
        fileExists: async (name) => {
          try {
            await carDirHandle.getFileHandle(name);
            return true;
          } catch {
            return false;
          }
        },
      });
      if (!fileName) {
        return;
      }

      const lspText = setupToLsp(edited);
      const newHandle = await carDirHandle.getFileHandle(fileName, { create: true });
      await writeFileHandle(newHandle, lspText);

      const newPath = `SavedGames/${carDir}/${fileName}`;
      const savedSetup = { ...edited, name: newPath };
      setSetups((prev) => [...prev, savedSetup]);
      fileHandles.current.set(newPath, newHandle);
      setLoadedPathsArr((prev) => [...prev, newPath]);
      editor.relocateSource(newPath);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to write file");
    }
  }, [editor, rbr.handle, setLoadedPathsArr]);

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

  // --- Shared view handlers ---
  // Track which shared setups have been saved to workspace (shared index → manualId)
  const [savedSharedMap, setSavedSharedMap] = useState<Map<number, string>>(new Map());
  const savedSharedIndices = useMemo(() => new Set(savedSharedMap.keys()), [savedSharedMap]);

  const handleToggleSaveSharedSetup = useCallback(
    (index: number) => {
      const existingId = savedSharedMap.get(index);
      if (existingId) {
        // Unsave: remove from manual entries and workspace
        setSavedSharedMap((prev) => {
          const next = new Map(prev);
          next.delete(index);
          return next;
        });
        setManualEntries((entries) => removeEntry(entries, existingId));
        setSetups((prev) =>
          prev.filter((s) => (s as CarSetup & { manualId?: string }).manualId !== existingId),
        );
      } else {
        // Save: create manual entry and add to workspace
        const setup = sharedSetups[index];
        if (!setup) {
          return;
        }
        const text = setupToLsp(setup);
        const entry = createManualEntry(setup.name, text);
        setSavedSharedMap((prev) => new Map(prev).set(index, entry.id));
        setManualEntries((prev) => [...prev, entry]);
        setSetups((prev) => [...prev, { ...setup, manualId: entry.id }]);
      }
    },
    [savedSharedMap, sharedSetups, setManualEntries],
  );

  const handleSaveSharedSetup = useCallback(
    (index: number) => {
      const setup = sharedSetups[index];
      if (!setup) {
        return;
      }
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
    [sharedSetups],
  );

  const handleReorderSharedSetup = useCallback((from: number, to: number) => {
    setSharedSetups((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  // Build the comparison, including the edited setup as the last column if editing
  // Gate on source setup being loaded — on restore, editState may exist before setups are populated
  const activeSetups = isViewingShared ? sharedSetups : setups;
  const sourceIndex =
    !isViewingShared && editor.editState
      ? setups.findIndex((s) => s.name === editor.editState?.sourceName)
      : -1;
  // When source IS the reference (index 0), orig and ref are the same column —
  // reset diffMode so it doesn't leak a stale toggle state after reorder.
  useEffect(() => {
    if (sourceIndex === 0 && editor.editState?.diffMode !== "vs-reference") {
      editor.setDiffMode("vs-reference");
    }
  }, [sourceIndex, editor]);

  const editedSetup = sourceIndex >= 0 ? editor.getEditedSetup() : null;
  const setupsForComparison = editedSetup ? [...activeSetups, editedSetup] : activeSetups;
  const comparison = setupsForComparison.length >= 1 ? compareSetups(setupsForComparison) : null;

  const setupNames = setupsForComparison.map((s) => s.name.split("/").pop() ?? s.name);

  // Indices of manual (floating) setups in workspace — for visual indicator
  const manualSetupIndices = useMemo(() => {
    const indices = new Set<number>();
    for (let i = 0; i < setups.length; i++) {
      if ((setups[i] as CarSetup & { manualId?: string }).manualId) {
        indices.add(i);
      }
    }
    return indices;
  }, [setups]);

  // Build editConfig for ComparisonTable
  const handleDiscardEdit = useCallback(() => {
    editor.discardEdit();
    setEditRanges(null);
  }, [editor]);

  const editConfig: EditConfig | undefined = (() => {
    if (!editor.editState || sourceIndex < 0) {
      return undefined;
    }
    const canToggleDiffMode = sourceIndex !== 0;
    const effectiveDiffMode = canToggleDiffMode ? editor.editState.diffMode : "vs-reference";
    const diffRefIndex = effectiveDiffMode === "vs-original" ? sourceIndex : 0;
    return {
      columnIndex: setups.length, // always last column
      diffRefIndex,
      canToggleDiffMode,
      edits: editor.editState.edits,
      diffMode: effectiveDiffMode,
      rangeMap: editRanges,
      onCellEdit: handleCellEdit,
      onCellReset: handleCellReset,
      onStep: handleStep,
      onToggleDiffMode: handleToggleDiffMode,
      onDiscard: handleDiscardEdit,
      onSave: handleSaveEdit,
      canOverwrite:
        fileHandles.current.has(editor.editState?.sourceName ?? "") &&
        isOverwritable(editor.editState?.sourceName ?? ""),
      onOverwrite: handleOverwriteEdit,
      onRenameAndSave: handleRenameAndSave,
      canSaveToSavedGames:
        !isOverwritable(editor.editState?.sourceName ?? "") &&
        fileHandles.current.has(editor.editState?.sourceName ?? "") &&
        savedGamesCarDir(editor.editState?.sourceName ?? "") !== null,
      onSaveToSavedGames: handleSaveToSavedGames,
    };
  })();

  const showSidebar = rbr.carGroups.length > 0 && !sidebarDismissed && !isViewingShared;
  const hasContent = isViewingShared || setups.length > 0 || showSidebar;

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
    <div className="flex h-screen bg-base text-text-primary">
      {!isViewingShared && (
        <DropZone
          hasFiles={true}
          onFilesSelected={processFiles}
          onBrowse={triggerFilePicker}
          error={null}
        />
      )}

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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-border border-b bg-surface px-4 py-2">
          {isViewingShared ? (
            <span className="select-none font-medium text-[10px] text-blue-400 uppercase tracking-widest">
              Viewing shared comparison
            </span>
          ) : (
            <span className="select-none font-medium text-[10px] text-text-muted uppercase tracking-widest">
              RBR Setup Compare
            </span>
          )}

          <div className="flex items-center gap-4">
            <span className="text-text-secondary text-xs">
              {activeSetups.length} file{activeSetups.length !== 1 ? "s" : ""}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={diffsOnly}
                onChange={(e) => setDiffsOnly(e.target.checked)}
                className="cursor-pointer accent-accent"
              />
              <span className="text-text-secondary text-xs uppercase tracking-wider">
                Diffs only
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showLspLabels}
                onChange={(e) => setShowLspLabels(e.target.checked)}
                className="cursor-pointer accent-accent"
              />
              <span className="text-text-secondary text-xs uppercase tracking-wider">
                LSP labels
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            {isViewingShared ? (
              <button
                type="button"
                onClick={() => {
                  setIsViewingShared(false);
                  clearUrlHash();
                }}
                className="cursor-pointer text-text-muted text-xs uppercase tracking-wider hover:text-text-secondary"
              >
                {savedSharedMap.size > 0
                  ? `Dismiss (${savedSharedMap.size} will be saved)`
                  : "Dismiss"}
              </button>
            ) : (
              <>
                {rbr.isSupported && !showSidebar && (
                  <button
                    type="button"
                    onClick={handleOpenDirectory}
                    className="cursor-pointer text-text-muted text-xs uppercase tracking-wider hover:text-text-secondary"
                  >
                    Open RBR folder
                  </button>
                )}
                <button
                  type="button"
                  disabled={setups.length === 0}
                  onClick={() => {
                    const msg = getClearAllConfirmMessage((editor.editState?.edits.size ?? 0) > 0);
                    if (!confirm(msg)) {
                      return;
                    }
                    editor.discardEdit();
                    setSetups([]);
                    setLoadedPathsArr([]);
                    setManualEntries([]);
                    clearUrlHash();
                  }}
                  className={`text-xs uppercase tracking-wider ${
                    setups.length === 0
                      ? "cursor-not-allowed text-text-muted/40"
                      : "cursor-pointer text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={setups.length === 0}
                  title="Copy a shareable link to this comparison"
                  className={`text-xs uppercase tracking-wider ${
                    setups.length === 0
                      ? "cursor-not-allowed text-text-muted/40"
                      : shareStatus
                        ? shareStatus.startsWith("Link")
                          ? "cursor-pointer text-diff-positive"
                          : "cursor-pointer text-diff-negative"
                        : "cursor-pointer text-blue-400 hover:text-blue-300"
                  }`}
                >
                  {shareStatus ?? "Copy share link"}
                </button>
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className="cursor-pointer font-medium text-accent text-xs uppercase tracking-wider hover:text-text-primary"
                >
                  + Add files
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error bar */}
        {error && !isViewingShared && (
          <div className="border-diff-negative/30 border-b bg-diff-negative/10 px-4 py-1.5 text-diff-negative text-xs">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="min-h-0 flex-1 p-4">
          <div className="h-full overflow-auto">
            {comparison ? (
              <ComparisonTable
                result={comparison}
                setupNames={setupNames}
                onRemoveSetup={isViewingShared ? undefined : handleRemoveSetup}
                onSaveSetup={isViewingShared ? handleSaveSharedSetup : handleSaveSetup}
                onReorderSetup={isViewingShared ? handleReorderSharedSetup : handleReorderSetup}
                diffsOnly={diffsOnly && activeSetups.length > 1}
                showLspLabels={showLspLabels}
                editConfig={isViewingShared ? undefined : editConfig}
                onStartEdit={isViewingShared ? undefined : handleStartEdit}
                editDisabledReason={isViewingShared ? "Save setup to edit it" : undefined}
                savedSetupIndices={
                  isViewingShared
                    ? savedSharedIndices
                    : manualSetupIndices.size > 0
                      ? manualSetupIndices
                      : undefined
                }
                onToggleSaveSetup={isViewingShared ? handleToggleSaveSharedSetup : undefined}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-text-muted text-xs uppercase tracking-wider">
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
