import { useState } from 'react'
import clsx from 'clsx'
import type { ComparisonResult } from '../lib/compare.ts'

type Props = {
  result: ComparisonResult
  setupNames: string[]
  onRemoveSetup: (index: number) => void
}

export function ComparisonTable({ result, setupNames, onRemoveSetup }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [diffsOnly, setDiffsOnly] = useState(false)

  const toggleSection = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm font-mono">
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
              <th key={i} className="text-left p-2 border border-gray-700 whitespace-nowrap">
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
}: {
  section: ComparisonResult[number]
  rows: ComparisonResult[number]['rows']
  columnCount: number
  isCollapsed: boolean
  onToggle: () => void
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
