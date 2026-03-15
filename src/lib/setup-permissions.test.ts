import { describe, expect, it } from "vitest";
import { isOverwritable, savedGamesCarDir } from "./setup-permissions.ts";

describe("isOverwritable", () => {
  it("returns true for SavedGames path", () => {
    expect(isOverwritable("SavedGames/Car/gravel.lsp")).toBe(true);
  });

  it("returns true for nested SavedGames path", () => {
    expect(isOverwritable("SavedGames/Car/subdir/setup.lsp")).toBe(true);
  });

  it("returns false for rsfdata/cars path", () => {
    expect(isOverwritable("rsfdata/cars/Car/setups/gravel.lsp")).toBe(false);
  });

  it("returns false for rsfdata/setups path", () => {
    expect(isOverwritable("rsfdata/setups/Car/gravel.lsp")).toBe(false);
  });

  it("returns false for Physics path", () => {
    expect(isOverwritable("Physics/Car/setups/gravel.lsp")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isOverwritable("")).toBe(false);
  });

  it("returns false for bare filename", () => {
    expect(isOverwritable("gravel.lsp")).toBe(false);
  });

  it("returns false for wrong case", () => {
    expect(isOverwritable("savedgames/Car/setup.lsp")).toBe(false);
  });

  it("returns false when SavedGames is a substring of a parent dir", () => {
    expect(isOverwritable("rsfdata/SavedGames/Car/setup.lsp")).toBe(false);
  });
});

describe("savedGamesCarDir", () => {
  it("keeps full rsfdata/cars car dir including suffix", () => {
    expect(savedGamesCarDir("rsfdata/cars/Lancer_EVO_9_NGP6/setups/gravel.lsp")).toBe(
      "Lancer_EVO_9_NGP6",
    );
  });

  it("returns rsfdata/cars car dir unchanged when no _ngp6", () => {
    expect(savedGamesCarDir("rsfdata/cars/Car/setups/gravel.lsp")).toBe("Car");
  });

  it("returns rsfdata/setups car dir as-is", () => {
    expect(savedGamesCarDir("rsfdata/setups/Lancer_EVO_9/gravel.lsp")).toBe("Lancer_EVO_9");
  });

  it("keeps full Physics car dir including suffix", () => {
    expect(savedGamesCarDir("Physics/Lancer_EVO_9_NGP6/setups/gravel.lsp")).toBe(
      "Lancer_EVO_9_NGP6",
    );
  });

  it("returns Physics car dir unchanged when no _ngp6", () => {
    expect(savedGamesCarDir("Physics/Car/setups/gravel.lsp")).toBe("Car");
  });

  it("returns SavedGames car dir as passthrough", () => {
    expect(savedGamesCarDir("SavedGames/Lancer_EVO_9/gravel.lsp")).toBe("Lancer_EVO_9");
  });

  it("returns null for empty string", () => {
    expect(savedGamesCarDir("")).toBeNull();
  });

  it("returns null for bare filename", () => {
    expect(savedGamesCarDir("gravel.lsp")).toBeNull();
  });

  it("returns null for unrecognized prefix", () => {
    expect(savedGamesCarDir("unknown/path/file.lsp")).toBeNull();
  });
});
