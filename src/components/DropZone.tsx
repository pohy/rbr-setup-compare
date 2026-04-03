import clsx from "clsx";
import { useEffect, useState } from "react";

type Props = {
  onFilesSelected: (files: FileList) => void;
  onBrowse: () => void;
  hasFiles: boolean;
  error: string | null;
  onOpenDirectory?: () => void;
  onLoadExample?: () => void;
  hasStoredHandle?: boolean;
  isDirectorySupported?: boolean;
};

export function DropZone({
  onFilesSelected,
  onBrowse,
  hasFiles,
  error,
  onOpenDirectory,
  onLoadExample,
  hasStoredHandle,
  isDirectorySupported,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const hasFileType = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (!hasFileType(e)) {
        return;
      }
      dragCounter++;
      if (dragCounter === 1) {
        setIsDragging(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (!hasFileType(e)) {
        return;
      }
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      if (!hasFileType(e)) {
        return;
      }
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) {
        onFilesSelected(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onFilesSelected]);

  // Full-screen prompt when no files loaded
  if (!hasFiles) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={clsx(
          "fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center",
          isDragging ? "border border-accent bg-base/90" : "bg-base",
        )}
        onClick={onBrowse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onBrowse();
          }
        }}
      >
        <p
          className={clsx(
            "mb-2 font-medium text-sm uppercase tracking-widest",
            isDragging ? "text-accent" : "text-text-secondary",
          )}
        >
          {isDragging ? "Drop .lsp files here" : "Drop .lsp setup files here"}
        </p>
        {!isDragging && (
          <p className="text-text-muted text-xs uppercase tracking-wider">or click to browse</p>
        )}
        {!isDragging && isDirectorySupported && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDirectory?.();
            }}
            className="mt-4 cursor-pointer border border-border px-4 py-1.5 text-text-secondary text-xs uppercase tracking-wider transition-colors hover:border-accent hover:text-accent"
          >
            {hasStoredHandle ? "Reopen RBR folder" : "Open RBR installation folder"}
          </button>
        )}
        {onLoadExample && !isDragging && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLoadExample();
            }}
            className="mt-3 cursor-pointer border border-border px-4 py-1.5 text-text-secondary text-xs uppercase tracking-wider transition-colors hover:border-accent hover:text-accent"
          >
            Show example comparison
          </button>
        )}
        {error && <p className="mt-4 max-w-md text-center text-diff-negative text-xs">{error}</p>}
      </div>
    );
  }

  // Drag overlay when files are already loaded
  if (isDragging) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center border border-accent bg-base/90">
        <p className="font-medium text-accent text-sm uppercase tracking-widest">
          Drop .lsp files to add
        </p>
      </div>
    );
  }

  return null;
}
