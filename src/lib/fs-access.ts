export function isFileSystemAccessSupported(): boolean {
  return typeof window.showDirectoryPicker === "function";
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new Error("File System Access API is not supported");
  }
  return window.showDirectoryPicker({ mode: "read" });
}

export async function checkPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.queryPermission({ mode: "read" })) === "granted";
}

export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if (await checkPermission(handle)) {
    return true;
  }
  return (await handle.requestPermission({ mode: "read" })) === "granted";
}

export async function readFileHandle(handle: {
  getFile(): Promise<{ text(): Promise<string> }>;
}): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function writeFileHandle(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    throw new Error("Write permission denied");
  }
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
