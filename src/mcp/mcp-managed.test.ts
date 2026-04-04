import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isMcpManaged, readMcpSidecar, sidecarPath, writeMcpSidecar } from "./mcp-managed.ts";

const TEST_DIR = join(tmpdir(), "rbr-mcp-sidecar-test");

beforeAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("sidecarPath", () => {
  it("appends .json to the lsp path", () => {
    expect(sidecarPath("/some/dir/setup.lsp")).toBe("/some/dir/setup.lsp.json");
  });
});

describe("writeMcpSidecar", () => {
  it("writes a JSON sidecar file alongside the lsp path", async () => {
    const lspPath = join(TEST_DIR, "write-test.lsp");
    await writeMcpSidecar(lspPath, { base: "base.lsp", meta: { purpose: "test" } });

    const content = JSON.parse(readFileSync(sidecarPath(lspPath), "utf-8"));
    expect(content.managed).toBe(true);
    expect(content.base).toBe("base.lsp");
    expect(content.meta).toEqual({ purpose: "test" });
    expect(content.updated).toBeDefined();
  });

  it("omits optional fields when not provided", async () => {
    const lspPath = join(TEST_DIR, "minimal-test.lsp");
    await writeMcpSidecar(lspPath, {});

    const content = JSON.parse(readFileSync(sidecarPath(lspPath), "utf-8"));
    expect(content.managed).toBe(true);
    expect(content.updated).toBeDefined();
    expect(content.base).toBeUndefined();
    expect(content.meta).toBeUndefined();
  });
});

describe("readMcpSidecar", () => {
  it("returns parsed sidecar data when file exists", async () => {
    const lspPath = join(TEST_DIR, "read-test.lsp");
    await writeMcpSidecar(lspPath, { base: "gravel.lsp", meta: { iteration: 3 } });

    const sidecar = await readMcpSidecar(lspPath);
    expect(sidecar).not.toBeNull();
    expect(sidecar?.managed).toBe(true);
    expect(sidecar?.base).toBe("gravel.lsp");
    expect(sidecar?.meta).toEqual({ iteration: 3 });
  });

  it("returns null when sidecar does not exist", async () => {
    const lspPath = join(TEST_DIR, "nonexistent.lsp");
    const sidecar = await readMcpSidecar(lspPath);
    expect(sidecar).toBeNull();
  });
});

describe("isMcpManaged", () => {
  it("returns true when sidecar file exists", async () => {
    const lspPath = join(TEST_DIR, "managed-test.lsp");
    await writeMcpSidecar(lspPath, {});
    expect(await isMcpManaged(lspPath)).toBe(true);
  });

  it("returns false when sidecar file does not exist", async () => {
    const lspPath = join(TEST_DIR, "plain-setup.lsp");
    expect(await isMcpManaged(lspPath)).toBe(false);
  });
});

describe("roundtrip", () => {
  it("writeMcpSidecar output is readable by readMcpSidecar", async () => {
    const lspPath = join(TEST_DIR, "roundtrip-test.lsp");
    await writeMcpSidecar(lspPath, {
      base: "d_gravel.lsp",
      meta: { tuned: true, iteration: 3 },
    });

    const sidecar = await readMcpSidecar(lspPath);
    expect(sidecar).not.toBeNull();
    expect(sidecar?.managed).toBe(true);
    expect(sidecar?.base).toBe("d_gravel.lsp");
    expect(sidecar?.meta).toEqual({ tuned: true, iteration: 3 });
    expect(sidecar?.updated).toBeDefined();
  });
});
