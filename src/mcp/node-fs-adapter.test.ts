import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IDirectoryHandle, IFileHandle } from "../lib/scanner-types.ts";
import { NodeDirectoryHandle } from "./node-fs-adapter.ts";

const TEST_DIR = join(tmpdir(), "rbr-mcp-adapter-test");

beforeAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(join(TEST_DIR, "subdir"), { recursive: true });
  writeFileSync(join(TEST_DIR, "hello.txt"), "hello world");
  writeFileSync(join(TEST_DIR, "setup.lsp"), '(("CarSetup"))');
  writeFileSync(join(TEST_DIR, "subdir", "nested.txt"), "nested content");
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("NodeDirectoryHandle", () => {
  it("has kind 'directory' and correct name", () => {
    const handle = new NodeDirectoryHandle(TEST_DIR);
    expect(handle.kind).toBe("directory");
    expect(handle.name).toBe("rbr-mcp-adapter-test");
  });

  it("lists entries with correct kinds", async () => {
    const handle = new NodeDirectoryHandle(TEST_DIR);
    const entries = new Map<string, IFileHandle | IDirectoryHandle>();
    for await (const [name, entry] of handle.entries()) {
      entries.set(name, entry);
    }

    expect(entries.size).toBe(3);
    expect(entries.get("hello.txt")?.kind).toBe("file");
    expect(entries.get("setup.lsp")?.kind).toBe("file");
    expect(entries.get("subdir")?.kind).toBe("directory");
  });

  it("getDirectoryHandle returns subdirectory handle", async () => {
    const handle = new NodeDirectoryHandle(TEST_DIR);
    const subdir = await handle.getDirectoryHandle("subdir");
    expect(subdir.kind).toBe("directory");
    expect(subdir.name).toBe("subdir");
  });

  it("getDirectoryHandle throws for non-existent directory", async () => {
    const handle = new NodeDirectoryHandle(TEST_DIR);
    await expect(handle.getDirectoryHandle("nope")).rejects.toThrow();
  });

  it("getDirectoryHandle throws for files", async () => {
    const handle = new NodeDirectoryHandle(TEST_DIR);
    await expect(handle.getDirectoryHandle("hello.txt")).rejects.toThrow();
  });
});

describe("NodeFileHandle (via entries)", () => {
  it("has kind 'file' and correct name", async () => {
    const handle = new NodeDirectoryHandle(TEST_DIR);
    for await (const [name, entry] of handle.entries()) {
      if (name === "hello.txt") {
        expect(entry.kind).toBe("file");
        expect(entry.name).toBe("hello.txt");
        return;
      }
    }
    throw new Error("hello.txt not found in entries");
  });

  it("getFile returns lastModified and readable text", async () => {
    const handle = new NodeDirectoryHandle(TEST_DIR);
    for await (const [name, entry] of handle.entries()) {
      if (name === "hello.txt" && entry.kind === "file") {
        const file = await entry.getFile();
        expect(file.lastModified).toBeGreaterThan(0);
        expect(await file.text()).toBe("hello world");
        return;
      }
    }
    throw new Error("hello.txt not found");
  });
});

describe("nested traversal", () => {
  it("can traverse into subdirectories and read files", async () => {
    const root = new NodeDirectoryHandle(TEST_DIR);
    const subdir = await root.getDirectoryHandle("subdir");
    const entries: string[] = [];
    for await (const [name, entry] of subdir.entries()) {
      entries.push(name);
      if (entry.kind === "file") {
        const file = await entry.getFile();
        expect(await file.text()).toBe("nested content");
      }
    }
    expect(entries).toEqual(["nested.txt"]);
  });
});
