/** Returns the confirm message for "Clear all". */
export function getClearAllConfirmMessage(hasEdits: boolean): string {
  return hasEdits
    ? "Remove all loaded setups and discard current edits?"
    : "Remove all loaded setups?";
}

/** Returns confirm message when removing a setup that is being edited with pending edits, or null. */
export function getRemoveConfirmMessage(
  editSourceName: string | undefined,
  hasEdits: boolean,
  removePath: string,
): string | null {
  if (!editSourceName || editSourceName !== removePath || !hasEdits) {
    return null;
  }
  const fileName = removePath.split("/").pop() ?? removePath;
  return `Remove "${fileName}" and discard unsaved edits?`;
}

type PromptDeps = {
  prompt: (message: string, defaultValue: string) => string | null;
  confirm: (message: string) => boolean;
  fileExists: (fileName: string) => Promise<boolean>;
};

/** Prompt for a filename, confirming if it would overwrite an existing file. Re-prompts on decline. */
export async function promptSaveAs(
  label: string,
  defaultName: string,
  deps: PromptDeps,
): Promise<string | null> {
  let currentDefault = defaultName;
  for (;;) {
    const name = deps.prompt(label, currentDefault);
    if (name == null || name === "") {
      return null;
    }
    const exists = await deps.fileExists(name);
    if (!exists || deps.confirm(`Overwrite "${name}"?`)) {
      return name;
    }
    currentDefault = name;
  }
}
