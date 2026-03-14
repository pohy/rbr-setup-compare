import type { DiffMode } from "../lib/use-setup-editor.ts";
import { PopoverMenu } from "./PopoverMenu.tsx";

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
      <PopoverMenu>
        <PopoverMenu.Item onClick={onToggleDiffMode} keepOpen>
          {diffMode === "vs-reference" ? "Compare vs original" : "Compare vs reference"}
        </PopoverMenu.Item>
        <PopoverMenu.Divider />
        <PopoverMenu.Item onClick={onSave} variant="accent">
          Download
        </PopoverMenu.Item>
        <PopoverMenu.Divider />
        <PopoverMenu.Item onClick={onDiscard} variant="danger">
          Discard edits
        </PopoverMenu.Item>
      </PopoverMenu>
    </div>
  );
}
