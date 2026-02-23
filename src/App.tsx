import { useState, useCallback } from 'react'
import type { CarSetup } from './lib/lsp-parser.ts'
import { compareSetups } from './lib/compare.ts'
import { sanitizeSetup } from './lib/sanitize.ts'
import { DropZone } from './components/DropZone.tsx'
import { ComparisonTable } from './components/ComparisonTable.tsx'

function App() {
  const [setups, setSetups] = useState<CarSetup[]>([])

  const handleFilesAdded = useCallback((newSetups: CarSetup[]) => {
    setSetups((prev) => [...prev, ...newSetups.map(sanitizeSetup)])
  }, [])

  const handleRemoveSetup = useCallback((index: number) => {
    setSetups((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleReorderSetup = useCallback((fromIndex: number, toIndex: number) => {
    setSetups((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const comparison = setups.length >= 1 ? compareSetups(setups) : null

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <DropZone onFilesAdded={handleFilesAdded} hasFiles={setups.length > 0} />

      {setups.length > 0 && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">RBR Setup Compare</h1>
            <button
              onClick={() => setSetups([])}
              className="text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
            >
              Clear all
            </button>
          </div>

          {comparison && (
            <ComparisonTable
              result={comparison}
              setupNames={setups.map((s) => s.name)}
              onRemoveSetup={handleRemoveSetup}
              onReorderSetup={handleReorderSetup}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App
