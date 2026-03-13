import type { DiffMode } from "../lib/use-setup-editor.ts";

type Props = {
  name: string;
  diffMode: DiffMode;
  onToggleDiffMode: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

export function EditColumnHeader({ name, diffMode, onToggleDiffMode, onDiscard, onSave }: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="truncate text-text-primary" title={name}>
          {name.replace(/\.lsp$/, "")}
        </span>
        <span className="text-accent text-[10px] uppercase tracking-wider shrink-0">(editing)</span>
      </div>
      <span className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleDiffMode}
          className="text-xs text-text-muted hover:text-text-secondary cursor-pointer"
          title={
            diffMode === "vs-reference"
              ? "Comparing vs reference (column 1)"
              : "Comparing vs original"
          }
        >
          {diffMode === "vs-reference" ? "vs ref" : "vs orig"}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="text-xs text-text-muted hover:text-accent cursor-pointer"
        >
          save
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="text-xs text-text-muted hover:text-diff-negative cursor-pointer"
        >
          discard
        </button>
      </span>
    </div>
  );
}
