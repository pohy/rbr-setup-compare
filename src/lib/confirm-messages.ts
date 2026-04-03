/** Returns the confirm message for "Clear all". */
export function getClearAllConfirmMessage(hasEdits: boolean): string {
  return hasEdits
    ? "Remove all loaded setups and discard current edits?"
    : "Remove all loaded setups?";
}

/** Returns confirm message if needed when unchecking a setup, or null if no confirm needed. */
export function getUncheckConfirmMessage(
  editSourceName: string | undefined,
  hasEdits: boolean,
  uncheckPath: string,
): string | null {
  if (!editSourceName || editSourceName !== uncheckPath || !hasEdits) {
    return null;
  }
  const fileName = uncheckPath.split("/").pop() ?? uncheckPath;
  return `Unchecking "${fileName}" will discard your unsaved edits.`;
}
