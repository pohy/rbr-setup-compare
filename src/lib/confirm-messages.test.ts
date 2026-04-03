import { describe, expect, it } from "vitest";
import { getClearAllConfirmMessage, getUncheckConfirmMessage } from "./confirm-messages.ts";

describe("getClearAllConfirmMessage", () => {
  it("returns base message when no active edits", () => {
    expect(getClearAllConfirmMessage(false)).toBe("Remove all loaded setups?");
  });

  it("includes edit warning when edits exist", () => {
    expect(getClearAllConfirmMessage(true)).toBe(
      "Remove all loaded setups and discard current edits?",
    );
  });
});

describe("getUncheckConfirmMessage", () => {
  it("returns null when unchecked setup is not the edited one", () => {
    expect(getUncheckConfirmMessage("car1/setup.lsp", true, "car2/other.lsp")).toBeNull();
  });

  it("returns null when there is no edit state", () => {
    expect(getUncheckConfirmMessage(undefined, false, "car1/setup.lsp")).toBeNull();
  });

  it("returns null when edit state has no pending edits", () => {
    expect(getUncheckConfirmMessage("car1/setup.lsp", false, "car1/setup.lsp")).toBeNull();
  });

  it("returns message mentioning the setup name when unchecking edited setup with edits", () => {
    const msg = getUncheckConfirmMessage("car1/setup.lsp", true, "car1/setup.lsp");
    expect(msg).toBe('Unchecking "setup.lsp" will discard your unsaved edits.');
  });
});
