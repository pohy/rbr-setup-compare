import { useState, useCallback } from "react";
import type { CarSetup } from "./lib/lsp-parser.ts";
import { compareSetups } from "./lib/compare.ts";
import { useFilePicker } from "./lib/use-file-picker.ts";
import { DropZone } from "./components/DropZone.tsx";
import { ComparisonTable } from "./components/ComparisonTable.tsx";

function App() {
  const [setups, setSetups] = useState<CarSetup[]>([]);
  const [diffsOnly, setDiffsOnly] = useState(true);

  const handleFilesReady = useCallback((newSetups: CarSetup[]) => {
    setSetups((prev) => [...prev, ...newSetups]);
  }, []);

  const { processFiles, triggerFilePicker, error } =
    useFilePicker(handleFilesReady);

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

  if (setups.length === 0) {
    return (
      <DropZone
        hasFiles={false}
        onFilesSelected={processFiles}
        onBrowse={triggerFilePicker}
        error={error}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base text-text-primary">
      <DropZone
        hasFiles={true}
        onFilesSelected={processFiles}
        onBrowse={triggerFilePicker}
        error={null}
      />

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
      <div className="flex-1 overflow-auto p-4">
        {comparison && (
          <ComparisonTable
            result={comparison}
            setupNames={setups.map((s) => s.name)}
            onRemoveSetup={handleRemoveSetup}
            onReorderSetup={handleReorderSetup}
            diffsOnly={diffsOnly}
          />
        )}
      </div>
    </div>
  );
}

export default App;
