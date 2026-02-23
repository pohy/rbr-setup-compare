import { useState, useRef, useCallback } from 'react'
import clsx from 'clsx'
import type { ComparisonResult } from '../lib/compare.ts'

type Props = {
  result: ComparisonResult
  setupNames: string[]
  onRemoveSetup: (index: number) => void
  onReorderSetup: (from: number, to: number) => void
}

export function ComparisonTable({ result, setupNames, onRemoveSetup, onReorderSetup }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [diffsOnly, setDiffsOnly] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const ghostRef = useRef<HTMLTableElement | null>(null)

  const toggleSection = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const clearDragState = useCallback(() => {
    setDragIndex(null)
    dragIndexRef.current = null
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current)
      ghostRef.current = null
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableCellElement>, index: number) => {
    e.preventDefault()
    const current = dragIndexRef.current
    if (current === null || current === index) return
    onReorderSetup(current, index)
    dragIndexRef.current = index
    setDragIndex(index)
  }, [onReorderSetup])

  const handleDrop = useCallback((e: React.DragEvent<HTMLTableCellElement>) => {
    e.preventDefault()
    clearDragState()
  }, [clearDragState])

  return (
    <div className="overflow-x-auto">
      <table ref={tableRef} className="border-collapse text-sm font-mono">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-800 text-gray-200">
            <th className="text-left p-2 border border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer font-normal">
                <input
                  type="checkbox"
                  checked={diffsOnly}
                  onChange={(e) => setDiffsOnly(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-xs text-gray-400">Diffs only</span>
              </label>
            </th>
            {setupNames.map((name, i) => (
                <th
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i)
                    dragIndexRef.current = i
                    e.dataTransfer.effectAllowed = 'move'

                    // Build a ghost image from the entire column
                    const table = tableRef.current
                    if (table) {
                      const colIdx = i + 1 // offset for the label column
                      const ghost = document.createElement('table')
                      ghost.className = table.className
                      for (const row of table.querySelectorAll('tr')) {
                        const cell = row.children[colIdx] as HTMLElement | undefined
                        if (!cell || cell.hasAttribute('colspan')) continue
                        const tr = document.createElement('tr')
                        tr.appendChild(cell.cloneNode(true))
                        ghost.appendChild(tr)
                      }
                      ghost.style.position = 'absolute'
                      ghost.style.top = '-9999px'
                      ghost.style.left = '-9999px'
                      document.body.appendChild(ghost)
                      ghostRef.current = ghost

                      const rect = e.currentTarget.getBoundingClientRect()
                      e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top)
                    }
                  }}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={handleDrop}
                  onDragEnd={clearDragState}
                  className={clsx(
                    'text-left p-2 border border-gray-700 whitespace-nowrap cursor-grab',
                    dragIndex !== null && dragIndex !== i && 'opacity-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate" title={name}>
                      {name.replace(/\.lsp$/, '')}
                    </span>
                    <button
                      onClick={() => onRemoveSetup(i)}
                      className="text-xs text-gray-500 hover:text-red-400 shrink-0 cursor-pointer"
                    >
                      remove
                    </button>
                  </div>
                </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.map((section) => {
            const visibleRows = diffsOnly
              ? section.rows.filter((r) => r.isDifferent)
              : section.rows
            if (diffsOnly && visibleRows.length === 0) return null
            return (
              <Section
                key={section.sectionName}
                section={section}
                rows={visibleRows}
                columnCount={setupNames.length}
                isCollapsed={collapsed[section.sectionName] ?? false}
                onToggle={() => toggleSection(section.sectionName)}
                dragIndex={dragIndex}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Section({
  section,
  rows,
  columnCount,
  isCollapsed,
  onToggle,
  dragIndex,
}: {
  section: ComparisonResult[number]
  rows: ComparisonResult[number]['rows']
  columnCount: number
  isCollapsed: boolean
  onToggle: () => void
  dragIndex: number | null
}) {
  const diffCount = section.rows.filter((r) => r.isDifferent).length

  return (
    <>
      <tr
        className="bg-gray-700 cursor-pointer hover:bg-gray-600 select-none"
        onClick={onToggle}
      >
        <td colSpan={columnCount + 1} className="p-2 border border-gray-600 font-semibold text-gray-100">
          <span className="mr-2 inline-block w-4 text-center">{isCollapsed ? '+' : '-'}</span>
          {section.sectionName}
          {diffCount > 0 && (
            <span className="ml-2 text-xs text-yellow-400">
              ({diffCount} diff{diffCount > 1 ? 's' : ''})
            </span>
          )}
        </td>
      </tr>
      {!isCollapsed &&
        rows.map((row) => (
          <tr
            key={`${section.sectionName}-${row.key}`}
            className={clsx(
              'hover:bg-gray-800/50',
              row.isDifferent ? 'bg-yellow-900/20' : '',
            )}
          >
            <td className="p-2 border border-gray-700 text-gray-300 whitespace-nowrap">{row.key}</td>
            {row.values.map((val, i) => (
              <td
                key={i}
                className={clsx(
                  'p-2 border border-gray-700 whitespace-nowrap',
                  val === null ? 'text-gray-600 italic' : 'text-gray-200',
                  row.isDifferent && val !== null ? 'text-yellow-300' : '',
                  dragIndex !== null && dragIndex !== i && 'opacity-50',
                )}
              >
                {val === null ? '-' : String(val)}
              </td>
            ))}
          </tr>
        ))}
    </>
  )
}
