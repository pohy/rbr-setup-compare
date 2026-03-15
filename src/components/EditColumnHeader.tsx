import type { DiffMode } from "../lib/use-setup-editor.ts";
import { PopoverMenu } from "./PopoverMenu.tsx";

type Props = {
  name: string;
  diffMode: DiffMode;
  onToggleDiffMode: () => void;
  onDiscard: () => void;
  onSave: () => void;
  canOverwrite: boolean;
  onOverwrite: (fileName: string) => void;
  canToggleDiffMode: boolean;
};

export function EditColumnHeader({
  name,
  diffMode,
  onToggleDiffMode,
  onDiscard,
  onSave,
  canOverwrite,
  onOverwrite,
  canToggleDiffMode,
}: Props) {
  return (
    <PopoverMenu
      label={
        <span className="truncate text-accent" title={name}>
          {name.replace(/\.lsp$/, "")}
        </span>
      }
      className="flex items-center justify-between gap-2"
    >
      <PopoverMenu.Item
        onClick={onToggleDiffMode}
        keepOpen
        disabled={!canToggleDiffMode}
        title={
          !canToggleDiffMode
            ? "Only one setup loaded — reference and original are the same"
            : undefined
        }
      >
        {diffMode === "vs-reference" ? "Compare vs original" : "Compare vs reference"}
      </PopoverMenu.Item>
      <PopoverMenu.Divider />
      <PopoverMenu.Item onClick={onSave} variant="accent">
        Download
      </PopoverMenu.Item>
      {canOverwrite && (
        <>
          <PopoverMenu.Item
            onClick={() => {
              if (window.confirm(`Overwrite ${name}?`)) {
                onOverwrite(name);
              }
            }}
            variant="accent"
          >
            Save by overwriting
          </PopoverMenu.Item>
          <PopoverMenu.Item
            onClick={() => {
              const result = window.prompt("Save to RBR folder as:", name);
              if (result != null && result !== "") {
                onOverwrite(result);
              }
            }}
            variant="accent"
          >
            Rename and save
          </PopoverMenu.Item>
        </>
      )}
      <PopoverMenu.Divider />
      <PopoverMenu.Item
        onClick={() => {
          if (window.confirm("Discard all edits?")) {
            onDiscard();
          }
        }}
        variant="danger"
      >
        Discard edits
      </PopoverMenu.Item>
    </PopoverMenu>
  );
}
