/**
 * Platform-agnostic filesystem interfaces for the RBR directory scanner.
 *
 * Browser: FileSystemDirectoryHandle/FileSystemFileHandle satisfy these structurally.
 * Node.js: NodeDirectoryHandle/NodeFileHandle (in src/mcp/node-fs-adapter.ts) implement them.
 */

export interface IFileHandle {
  readonly name: string;
  readonly kind: "file";
  getFile(): Promise<{ lastModified: number; text(): Promise<string> }>;
}

export interface IDirectoryHandle {
  readonly name: string;
  readonly kind: "directory";
  entries(): AsyncIterable<[string, IFileHandle | IDirectoryHandle]>;
  getDirectoryHandle(name: string): Promise<IDirectoryHandle>;
}

export type ScannedSetup = {
  relativePath: string;
  carName: string;
  carDir: string;
  fileName: string;
  source: "driver-setup" | "user-setup";
  fileRef: IFileHandle;
};

export type RangeFileEntry = {
  surface: string;
  fileRef: IFileHandle;
};

export type CarInfo = {
  name: string;
  drivetrain: string;
  weight: number;
  power: string;
  year: number;
  category: string;
};

export type CarGroup = {
  carName: string;
  carDir: string;
  setups: ScannedSetup[];
  rangeFiles: RangeFileEntry[];
  carInfo: CarInfo | null;
};

export function formatCarName(dirName: string): string {
  return dirName.replace(/_ngp6$/i, "").replace(/_/g, " ");
}

export const RANGE_FILE_RE = /^r_(.+)\.lsp$/;

export const RSF_DEFAULT_COPY_RE = /^\d+_d_/;
