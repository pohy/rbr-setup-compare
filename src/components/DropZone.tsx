import { useState, useEffect, useCallback } from 'react'
import { parseLspSetup, type CarSetup } from '../lib/lsp-parser.ts'
import clsx from 'clsx'

type Props = {
  onFilesAdded: (setups: CarSetup[]) => void
  hasFiles: boolean
}

export function DropZone({ onFilesAdded, hasFiles }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFiles = useCallback(
    async (files: FileList) => {
      setError(null)
      const results: CarSetup[] = []

      for (const file of Array.from(files)) {
        if (!file.name.endsWith('.lsp')) continue
        try {
          const text = await file.text()
          const setup = parseLspSetup(text, file.name)
          results.push(setup)
        } catch (e) {
          setError(`Failed to parse ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
          return
        }
      }

      if (results.length > 0) {
        onFilesAdded(results)
      }
    },
    [onFilesAdded],
  )

  useEffect(() => {
    let dragCounter = 0

    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      if (!hasFiles(e)) return
      dragCounter++
      if (dragCounter === 1) setIsDragging(true)
    }
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      if (!hasFiles(e)) return
      dragCounter--
      if (dragCounter === 0) setIsDragging(false)
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragCounter = 0
      setIsDragging(false)
      if (e.dataTransfer?.files.length) {
        processFiles(e.dataTransfer.files)
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
  }, [processFiles])

  const handleClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.lsp'
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        processFiles(input.files)
      }
    }
    input.click()
  }, [processFiles])

  // Full-screen prompt when no files loaded
  if (!hasFiles) {
    return (
      <div
        className={clsx(
          'fixed inset-0 flex flex-col items-center justify-center cursor-pointer z-50',
          isDragging ? 'bg-blue-500/20 border-4 border-dashed border-blue-400' : 'bg-gray-900',
        )}
        onClick={handleClick}
      >
        <p className="text-2xl font-semibold text-gray-200 mb-2">
          {isDragging ? 'Drop .lsp files here' : 'Drop .lsp setup files here'}
        </p>
        {!isDragging && <p className="text-gray-400">or click to browse</p>}
        {error && <p className="mt-4 text-red-400 text-sm max-w-md text-center">{error}</p>}
      </div>
    )
  }

  // Drag overlay when files are already loaded
  if (isDragging) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-500/20 border-4 border-dashed border-blue-400">
        <p className="text-2xl font-semibold text-gray-200">Drop .lsp files to add</p>
      </div>
    )
  }

  return error ? (
    <div className="px-4 pt-2">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  ) : null
}
