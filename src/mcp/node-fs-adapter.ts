import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { IDirectoryHandle, IFileHandle } from "../lib/scanner-types.ts";

export class NodeFileHandle implements IFileHandle {
  readonly kind = "file" as const;
  readonly name: string;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.name = basename(filePath);
  }

  async getFile() {
    const path = this.filePath;
    const stats = await stat(path);
    return {
      lastModified: stats.mtimeMs,
      text: () => readFile(path, "utf-8"),
    };
  }
}

export class NodeDirectoryHandle implements IDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  private dirPath: string;

  constructor(dirPath: string) {
    this.dirPath = dirPath;
    this.name = basename(dirPath);
  }

  async *entries(): AsyncIterable<[string, IFileHandle | IDirectoryHandle]> {
    const dirents = await readdir(this.dirPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = join(this.dirPath, dirent.name);
      if (dirent.isDirectory()) {
        yield [dirent.name, new NodeDirectoryHandle(fullPath)];
      } else if (dirent.isFile()) {
        yield [dirent.name, new NodeFileHandle(fullPath)];
      }
    }
  }

  async getDirectoryHandle(name: string): Promise<IDirectoryHandle> {
    const fullPath = join(this.dirPath, name);
    const stats = await stat(fullPath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${fullPath}`);
    }
    return new NodeDirectoryHandle(fullPath);
  }
}
