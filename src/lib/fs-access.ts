export function isFileSystemAccessSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker!({ mode: 'read' })
}

export async function checkPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  return (await handle.queryPermission({ mode: 'read' })) === 'granted'
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (await checkPermission(handle)) {
    return true
  }
  return (await handle.requestPermission({ mode: 'read' })) === 'granted'
}

export async function readFileHandle(
  handle: FileSystemFileHandle,
): Promise<string> {
  const file = await handle.getFile()
  return file.text()
}
