import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import type { CarGroup, ScannedSetup } from "../lib/rbr-scanner.ts";
import { usePersistentState } from "../lib/use-persistent-state.ts";

type Props = {
  carGroups: CarGroup[];
  isScanning: boolean;
  error: string | null;
  loadedPaths: ReadonlySet<string>;
  loadingPaths: ReadonlySet<string>;
  onToggleSetup: (setup: ScannedSetup, loaded: boolean) => void;
  onChangeFolder: () => void;
  onDisconnect: () => void;
};

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
  const [expanded, setExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = usePersistentState("rbr-setup-filter", "");
  const filterRef = useRef<HTMLInputElement>(null);

  const filterLower = filter.toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!filterLower) {
      return carGroups;
    }
    return carGroups
      .map((group) => {
        const carMatch = group.carName.toLowerCase().includes(filterLower);
        if (carMatch) {
          return group;
        }
        const matchingSetups = group.setups.filter((s) =>
          s.fileName.toLowerCase().includes(filterLower),
        );
        if (matchingSetups.length === 0) {
          return null;
        }
        return { ...group, setups: matchingSetups };
      })
      .filter((g): g is CarGroup => g !== null);
  }, [carGroups, filterLower]);

  const toggleGroup = (carName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [carName]: !prev[carName] }));
  };

  // Collapsed state — thin vertical strip
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 border-border border-r bg-surface transition-colors hover:bg-elevated"
      >
        <span className="rotate-180 select-none font-medium text-[10px] text-text-muted uppercase tracking-widest [writing-mode:vertical-lr]">
          Setups
        </span>
        <span className="text-text-muted text-xs">&#x25B6;</span>
      </button>
    );
  }

  // Expanded state
  return (
    <div className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-border border-r bg-surface">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="flex w-full cursor-pointer items-center justify-between border-border border-b px-3 py-2 transition-colors hover:bg-elevated"
      >
        <span className="select-none font-medium text-[10px] text-text-muted uppercase tracking-widest">
          Setups
        </span>
        <span className="text-text-muted text-xs">&#x25C0;</span>
      </button>

      {/* Search */}
      <div className="relative border-border border-b px-3 py-2">
        <input
          ref={filterRef}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter cars / files..."
          className="w-full border border-border bg-base px-2 py-1 pr-6 text-text-primary text-xs placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        {filter && (
          <button
            type="button"
            onClick={() => {
              setFilter("");
              filterRef.current?.focus();
            }}
            className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer p-0.5 text-text-muted text-xs leading-none hover:text-text-primary"
            aria-label="Clear filter"
          >
            &#x2715;
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isScanning && (
          <div className="px-3 py-4 text-text-muted text-xs uppercase tracking-wider">
            Scanning...
          </div>
        )}

        {error && <div className="px-3 py-3 text-diff-negative text-xs">{error}</div>}

        {!isScanning &&
          !error &&
          filteredGroups.map((group) => {
            const isCollapsed = collapsedGroups[group.carName] ?? false;
            const groupLoaded = group.setups.filter((s) => loadedPaths.has(s.relativePath)).length;

            return (
              <div key={group.carName} className="border-border border-b">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.carName)}
                  className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left font-medium text-[11px] text-text-primary uppercase tracking-wider hover:bg-elevated"
                >
                  <span className="truncate">
                    <span className="mr-1 inline-block w-4 text-center text-accent">
                      {isCollapsed ? "+" : "\u2212"}
                    </span>
                    {group.carName}
                  </span>
                  {groupLoaded > 0 && (
                    <span className="ml-2 shrink-0 text-[10px] text-accent-dim">{groupLoaded}</span>
                  )}
                </button>
                {!isCollapsed && (
                  <div className="pb-1">
                    {group.setups.map((setup) => {
                      const isLoaded = loadedPaths.has(setup.relativePath);
                      const isLoadingThis = loadingPaths.has(setup.relativePath);
                      return (
                        <label
                          key={setup.relativePath}
                          className={clsx(
                            "flex items-center gap-2 px-3 py-0.5 text-xs",
                            isLoadingThis
                              ? "cursor-wait opacity-50"
                              : "cursor-pointer hover:bg-elevated/50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isLoaded}
                            disabled={isLoadingThis}
                            onChange={() => onToggleSetup(setup, isLoaded)}
                            className="shrink-0 cursor-pointer accent-accent"
                          />
                          <span
                            className={clsx(
                              "truncate",
                              setup.source === "user-setup"
                                ? "text-accent-dim"
                                : "text-text-secondary",
                            )}
                            title={setup.relativePath}
                          >
                            {setup.fileName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="flex gap-2 border-border border-t px-3 py-2">
        <button
          type="button"
          onClick={onChangeFolder}
          className="flex-1 cursor-pointer py-1 text-[10px] text-text-muted uppercase tracking-wider hover:text-text-secondary"
        >
          Change folder
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          className="flex-1 cursor-pointer py-1 text-[10px] text-text-muted uppercase tracking-wider hover:text-text-secondary"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
