import { useState, useCallback } from 'react'
import { parseLspSetup, type CarSetup } from './lsp-parser.ts'
import { sanitizeSetup } from './sanitize.ts'

export function useFilePicker(onFilesReady: (setups: CarSetup[]) => void) {
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
          results.push(sanitizeSetup(setup))
        } catch (e) {
          setError(`Failed to parse ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
          return
        }
      }

      if (results.length > 0) {
        onFilesReady(results)
      }
    },
    [onFilesReady],
  )

  const triggerFilePicker = useCallback(() => {
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

  return { processFiles, triggerFilePicker, error }
}
