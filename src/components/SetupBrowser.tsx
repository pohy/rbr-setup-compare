import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { CarGroup, ScannedSetup } from '../lib/rbr-scanner.ts'

type Props = {
  carGroups: CarGroup[]
  isScanning: boolean
  error: string | null
  loadedPaths: ReadonlySet<string>
  loadingPaths: ReadonlySet<string>
  onToggleSetup: (setup: ScannedSetup, loaded: boolean) => void
  onChangeFolder: () => void
  onDisconnect: () => void
}

export function SetupBrowser({
  carGroups,
  isScanning,
  error,
  loadedPaths,
  loadingPaths,
  onToggleSetup,
  onChangeFolder,
  onDisconnect,
}: Props) {
  const [expanded, setExpanded] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState(() => localStorage.getItem('rbr-setup-filter') ?? '')

  const updateFilter = (value: string) => {
    setFilter(value)
    localStorage.setItem('rbr-setup-filter', value)
  }

  const filterLower = filter.toLowerCase()

  const filteredGroups = useMemo(() => {
    if (!filterLower) return carGroups
    return carGroups
      .map((group) => {
        const carMatch = group.carName.toLowerCase().includes(filterLower)
        if (carMatch) return group
        const matchingSetups = group.setups.filter((s) =>
          s.fileName.toLowerCase().includes(filterLower),
        )
        if (matchingSetups.length === 0) return null
        return { ...group, setups: matchingSetups }
      })
      .filter((g): g is CarGroup => g !== null)
  }, [carGroups, filterLower])

  const toggleGroup = (carName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [carName]: !prev[carName] }))
  }

  // Collapsed state — thin vertical strip
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="shrink-0 w-10 bg-surface border-r border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-elevated transition-colors"
      >
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium [writing-mode:vertical-lr] rotate-180 select-none">
          Setups
        </span>
        <span className="text-text-muted text-xs">&#x25B6;</span>
      </button>
    )
  }

  // Expanded state
  return (
    <div className="shrink-0 w-80 bg-surface border-r border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(false)}
        className="flex items-center justify-between px-3 py-2 border-b border-border cursor-pointer hover:bg-elevated transition-colors w-full"
      >
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium select-none">
          Setups
        </span>
        <span className="text-text-muted text-xs">&#x25C0;</span>
      </button>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <input
          type="text"
          value={filter}
          onChange={(e) => updateFilter(e.target.value)}
          placeholder="Filter cars / files..."
          className="w-full bg-base border border-border px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isScanning && (
          <div className="px-3 py-4 text-xs text-text-muted uppercase tracking-wider">
            Scanning...
          </div>
        )}

        {error && (
          <div className="px-3 py-3 text-xs text-diff-negative">{error}</div>
        )}

        {!isScanning &&
          !error &&
          filteredGroups.map((group) => {
            const isCollapsed = collapsedGroups[group.carName] ?? false
            const groupLoaded = group.setups.filter((s) =>
              loadedPaths.has(s.relativePath),
            ).length

            return (
              <div key={group.carName} className="border-b border-border">
                <button
                  onClick={() => toggleGroup(group.carName)}
                  className="w-full text-left px-3 py-1.5 text-[11px] uppercase tracking-wider font-medium text-text-primary hover:bg-elevated cursor-pointer flex items-center justify-between"
                >
                  <span className="truncate">
                    <span className="inline-block w-4 text-center text-accent mr-1">
                      {isCollapsed ? '+' : '\u2212'}
                    </span>
                    {group.carName}
                  </span>
                  {groupLoaded > 0 && (
                    <span className="text-accent-dim text-[10px] ml-2 shrink-0">
                      {groupLoaded}
                    </span>
                  )}
                </button>
                {!isCollapsed && (
                  <div className="pb-1">
                    {group.setups.map((setup) => {
                      const isLoaded = loadedPaths.has(setup.relativePath)
                      const isLoadingThis = loadingPaths.has(setup.relativePath)
                      return (
                        <label
                          key={setup.relativePath}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-0.5 text-xs',
                            isLoadingThis
                              ? 'opacity-50 cursor-wait'
                              : 'cursor-pointer hover:bg-elevated/50',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isLoaded}
                            disabled={isLoadingThis}
                            onChange={() => onToggleSetup(setup, isLoaded)}
                            className="accent-accent cursor-pointer shrink-0"
                          />
                          <span
                            className={clsx(
                              'truncate',
                              setup.source === 'user-setup'
                                ? 'text-accent-dim'
                                : 'text-text-secondary',
                            )}
                            title={setup.relativePath}
                          >
                            {setup.fileName}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2 flex gap-2">
        <button
          onClick={onChangeFolder}
          className="flex-1 py-1 text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary cursor-pointer"
        >
          Change folder
        </button>
        <button
          onClick={onDisconnect}
          className="flex-1 py-1 text-[10px] uppercase tracking-wider text-text-muted hover:text-text-secondary cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}
