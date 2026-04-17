import type { DiffMode } from "../lib/use-setup-editor.ts";
import { PopoverMenu } from "./PopoverMenu.tsx";

type Props = {
  name: string;
  diffMode: DiffMode;
  onToggleDiffMode: () => void;
  onDiscard: () => void;
  onSave: () => void;
  canOverwrite: boolean;
  onOverwrite: () => void;
  onRenameAndSave: () => void;
  canSaveToSavedGames: boolean;
  onSaveToSavedGames: () => void;
  canToggleDiffMode: boolean;
  hasEdits: boolean;
  referenceName: string;
  originalName: string;
};

export function EditColumnHeader({
  name,
  diffMode,
  onToggleDiffMode,
  onDiscard,
  onSave,
  canOverwrite,
  onOverwrite,
  onRenameAndSave,
  canSaveToSavedGames,
  onSaveToSavedGames,
  canToggleDiffMode,
  hasEdits,
  referenceName,
  originalName,
}: Props) {
  const diffTargetName = diffMode === "vs-reference" ? originalName : referenceName;
  return (
    <PopoverMenu
      label={
        <span className="truncate text-accent" title={name}>
          {name.replace(/\.lsp$/, "")}
        </span>
      }
      className="flex items-center justify-between gap-2"
    >
      {canOverwrite && (
        <>
          <PopoverMenu.Item
            onClick={() => {
              if (window.confirm(`Overwrite ${name}?`)) {
                onOverwrite();
              }
            }}
            variant="accent"
            disabled={!hasEdits}
            title={!hasEdits ? "No changes to save" : undefined}
          >
            Save by overwriting...
          </PopoverMenu.Item>
          <PopoverMenu.Item onClick={onRenameAndSave} variant="accent">
            Rename and save...
          </PopoverMenu.Item>
        </>
      )}
      {canSaveToSavedGames && (
        <PopoverMenu.Item onClick={onSaveToSavedGames} variant="accent">
          Save to SavedGames
        </PopoverMenu.Item>
      )}
      <PopoverMenu.Item onClick={onSave} variant="accent">
        Download...
      </PopoverMenu.Item>
      <PopoverMenu.Divider />
      <PopoverMenu.Item
        onClick={onToggleDiffMode}
        keepOpen
        disabled={!canToggleDiffMode}
        title={
          !canToggleDiffMode
            ? "Only one setup loaded — reference and original are the same"
            : `Compare vs ${diffTargetName}`
        }
      >
        {diffMode === "vs-reference" ? "Compare vs original" : "Compare vs reference"}
      </PopoverMenu.Item>
      <PopoverMenu.Divider />
      {hasEdits ? (
        <PopoverMenu.Item
          onClick={() => {
            if (window.confirm("Discard all edits?")) {
              onDiscard();
            }
          }}
          variant="danger"
        >
          Close editor and discard edits...
        </PopoverMenu.Item>
      ) : (
        <PopoverMenu.Item onClick={onDiscard}>Close editor</PopoverMenu.Item>
      )}
    </PopoverMenu>
  );
}
