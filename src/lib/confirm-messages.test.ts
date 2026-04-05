import { describe, expect, it, vi } from "vitest";
import {
  getClearAllConfirmMessage,
  getUncheckConfirmMessage,
  promptSaveAs,
} from "./confirm-messages.ts";

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

describe("promptSaveAs", () => {
  it("returns chosen filename when file does not exist", async () => {
    const prompt = vi.fn().mockReturnValue("new-setup.lsp");
    const confirm = vi.fn();
    const fileExists = vi.fn().mockResolvedValue(false);

    const result = await promptSaveAs("Save as:", "default.lsp", { prompt, confirm, fileExists });

    expect(result).toBe("new-setup.lsp");
    expect(prompt).toHaveBeenCalledWith("Save as:", "default.lsp");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("returns null when user cancels the prompt", async () => {
    const prompt = vi.fn().mockReturnValue(null);
    const confirm = vi.fn();
    const fileExists = vi.fn();

    const result = await promptSaveAs("Save as:", "default.lsp", { prompt, confirm, fileExists });

    expect(result).toBeNull();
    expect(fileExists).not.toHaveBeenCalled();
  });

  it("returns null when user enters empty string", async () => {
    const prompt = vi.fn().mockReturnValue("");
    const confirm = vi.fn();
    const fileExists = vi.fn();

    const result = await promptSaveAs("Save as:", "default.lsp", { prompt, confirm, fileExists });

    expect(result).toBeNull();
    expect(fileExists).not.toHaveBeenCalled();
  });

  it("returns filename when file exists and user confirms overwrite", async () => {
    const prompt = vi.fn().mockReturnValue("existing.lsp");
    const confirm = vi.fn().mockReturnValue(true);
    const fileExists = vi.fn().mockResolvedValue(true);

    const result = await promptSaveAs("Save as:", "default.lsp", { prompt, confirm, fileExists });

    expect(result).toBe("existing.lsp");
    expect(confirm).toHaveBeenCalledWith('Overwrite "existing.lsp"?');
  });

  it("re-prompts when file exists and user declines overwrite", async () => {
    const prompt = vi.fn().mockReturnValueOnce("existing.lsp").mockReturnValueOnce("different.lsp");
    const confirm = vi.fn().mockReturnValue(false);
    const fileExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await promptSaveAs("Save as:", "default.lsp", { prompt, confirm, fileExists });

    expect(result).toBe("different.lsp");
    expect(prompt).toHaveBeenCalledTimes(2);
    // Second prompt should default to the previously entered name
    expect(prompt).toHaveBeenLastCalledWith("Save as:", "existing.lsp");
  });

  it("returns null when user cancels after declining overwrite", async () => {
    const prompt = vi.fn().mockReturnValueOnce("existing.lsp").mockReturnValueOnce(null);
    const confirm = vi.fn().mockReturnValue(false);
    const fileExists = vi.fn().mockResolvedValue(true);

    const result = await promptSaveAs("Save as:", "default.lsp", { prompt, confirm, fileExists });

    expect(result).toBeNull();
    expect(prompt).toHaveBeenCalledTimes(2);
  });

  it("uses the provided label in the prompt", async () => {
    const prompt = vi.fn().mockReturnValue("setup.lsp");
    const confirm = vi.fn();
    const fileExists = vi.fn().mockResolvedValue(false);

    await promptSaveAs("Save to RBR folder as:", "default.lsp", { prompt, confirm, fileExists });

    expect(prompt).toHaveBeenCalledWith("Save to RBR folder as:", "default.lsp");
  });
});
