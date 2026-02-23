import { useState, useEffect } from 'react'
import clsx from 'clsx'

type Props = {
  onFilesSelected: (files: FileList) => void
  onBrowse: () => void
  hasFiles: boolean
  error: string | null
}

export function DropZone({ onFilesSelected, onBrowse, hasFiles, error }: Props) {
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    let dragCounter = 0

    const hasFileType = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      if (!hasFileType(e)) return
      dragCounter++
      if (dragCounter === 1) setIsDragging(true)
    }
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      if (!hasFileType(e)) return
      dragCounter--
      if (dragCounter === 0) setIsDragging(false)
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const handleDrop = (e: DragEvent) => {
      if (!hasFileType(e)) return
      e.preventDefault()
      dragCounter = 0
      setIsDragging(false)
      if (e.dataTransfer?.files.length) {
        onFilesSelected(e.dataTransfer.files)
      }
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [onFilesSelected])

  // Full-screen prompt when no files loaded
  if (!hasFiles) {
    return (
      <div
        className={clsx(
          'fixed inset-0 flex flex-col items-center justify-center cursor-pointer z-50',
          isDragging ? 'bg-base/90 border border-accent' : 'bg-base',
        )}
        onClick={onBrowse}
      >
        <p
          className={clsx(
            'text-sm uppercase tracking-widest font-medium mb-2',
            isDragging ? 'text-accent' : 'text-text-secondary',
          )}
        >
          {isDragging ? 'Drop .lsp files here' : 'Drop .lsp setup files here'}
        </p>
        {!isDragging && (
          <p className="text-xs uppercase tracking-wider text-text-muted">or click to browse</p>
        )}
        {error && <p className="mt-4 text-diff-negative text-xs max-w-md text-center">{error}</p>}
      </div>
    )
  }

  // Drag overlay when files are already loaded
  if (isDragging) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/90 border border-accent">
        <p className="text-sm uppercase tracking-widest font-medium text-accent">
          Drop .lsp files to add
        </p>
      </div>
    )
  }

  return null
}
