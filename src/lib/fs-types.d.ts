interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface Window {
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?:
    | FileSystemHandle
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";
}

// FileSystemObserver API (Chrome 133+)
interface FileSystemChangeRecord {
  type: "appeared" | "disappeared" | "modified" | "moved" | "unknown" | "errored";
  relativePathComponents: string[];
  relativePathMovedFrom?: string[];
  changedHandle: FileSystemHandle | null;
  root: FileSystemDirectoryHandle;
}

type FileSystemObserverCallback = (
  records: FileSystemChangeRecord[],
  observer: FileSystemObserver,
) => void;

interface FileSystemObserver {
  observe(handle: FileSystemHandle, options?: { recursive?: boolean }): Promise<void>;
  disconnect(): void;
}

declare var FileSystemObserver:
  | { new (callback: FileSystemObserverCallback): FileSystemObserver }
  | undefined;
