import { useState, useRef, useCallback, useEffect } from "react";
import clsx from "clsx";
import type { ComparisonResult } from "../lib/compare.ts";

type Props = {
  result: ComparisonResult;
  setupNames: string[];
  onRemoveSetup: (index: number) => void;
  onReorderSetup: (from: number, to: number) => void;
  diffsOnly: boolean;
};

export function ComparisonTable({
  result,
  setupNames,
  onRemoveSetup,
  onReorderSetup,
  diffsOnly,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const paramColRef = useRef<HTMLDivElement>(null);
  const [paramColWidth, setParamColWidth] = useState(0);

  useEffect(() => {
    const el = paramColRef.current;
    if (!el) return;
    setParamColWidth(el.offsetWidth);
    const ro = new ResizeObserver(() => setParamColWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleSection = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const clearDragState = useCallback(() => {
    setDragIndex(null);
    dragIndexRef.current = null;
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>, index: number) => {
      e.preventDefault();
      const current = dragIndexRef.current;
      if (current === null || current === index) return;
      onReorderSetup(current, index);
      dragIndexRef.current = index;
      setDragIndex(index);
    },
    [onReorderSetup],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      clearDragState();
    },
    [clearDragState],
  );

  const colCount = setupNames.length + 1;

  return (
    <div ref={containerRef} className="mx-auto w-fit">
      <div
        className="grid text-sm"
        style={{
          gridTemplateColumns: `auto repeat(${setupNames.length}, auto)`,
          "--param-w": `${paramColWidth}px`,
        } as React.CSSProperties}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 grid grid-cols-subgrid bg-elevated text-text-secondary"
          style={{ gridColumn: `span ${colCount}` }}
        >
          <div ref={paramColRef} className="sticky left-0 z-20 bg-elevated p-2 border border-border text-[10px] uppercase tracking-widest text-text-muted font-medium">
            Parameter
          </div>
          {setupNames.map((name, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                dragIndexRef.current = i;
                e.dataTransfer.effectAllowed = "move";

                const container = containerRef.current;
                if (container) {
                  const ghost = document.createElement("div");
                  ghost.className = "text-sm";
                  for (const cell of container.querySelectorAll(
                    `[data-col="${i}"]`,
                  )) {
                    ghost.appendChild(cell.cloneNode(true));
                  }
                  ghost.style.position = "absolute";
                  ghost.style.top = "-9999px";
                  ghost.style.left = "-9999px";
                  document.body.appendChild(ghost);
                  ghostRef.current = ghost;

                  const rect = e.currentTarget.getBoundingClientRect();
                  e.dataTransfer.setDragImage(
                    ghost,
                    e.clientX - rect.left,
                    e.clientY - rect.top,
                  );
                }
              }}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={handleDrop}
              onDragEnd={clearDragState}
              className={clsx(
                "p-2 border border-border whitespace-nowrap cursor-grab",
                i === 0 && "sticky left-[var(--param-w)] z-20 bg-elevated",
                dragIndex !== null && dragIndex !== i && "opacity-50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-text-primary" title={name}>
                  {name.replace(/\.lsp$/, "")}
                </span>
                <button
                  onClick={() => onRemoveSetup(i)}
                  className="text-xs text-text-muted hover:text-diff-negative shrink-0 cursor-pointer"
                >
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Sections */}
        {result.map((section) => {
          const visibleRows = diffsOnly
            ? section.rows.filter((r, i, arr) => {
                if (r.type === 'split') {
                  const prev = arr[i - 1]
                  const next = arr[i + 1]
                  return prev?.type === 'data' && prev.isDifferent
                      && next?.type === 'data' && next.isDifferent
                }
                return r.isDifferent
              })
            : section.rows;
          if (diffsOnly && visibleRows.length === 0) return null;
          return (
            <Section
              key={section.sectionName}
              section={section}
              rows={visibleRows}
              colCount={colCount}
              isCollapsed={collapsed[section.sectionName] ?? false}
              onToggle={() => toggleSection(section.sectionName)}
              dragIndex={dragIndex}
            />
          );
        })}
      </div>
    </div>
  );
}

function Section({
  section,
  rows,
  colCount,
  isCollapsed,
  onToggle,
  dragIndex,
}: {
  section: ComparisonResult[number];
  rows: ComparisonResult[number]["rows"];
  colCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  dragIndex: number | null;
}) {
  const diffCount = section.rows.filter((r) => r.type === 'data' && r.isDifferent).length;

  return (
    <div
      className="grid grid-cols-subgrid"
      style={{ gridColumn: `span ${colCount}` }}
    >
      {/* Section header */}
      <div
        className="sticky top-[37px] z-[8] bg-elevated hover:bg-[#2e2e28] cursor-pointer select-none border border-border"
        style={{ gridColumn: `span ${colCount}` }}
        onClick={onToggle}
      >
        <div className="sticky left-0 w-fit p-2 border-l-2 border-l-accent uppercase tracking-wider text-xs font-medium text-text-primary whitespace-nowrap">
          <span className="mr-2 inline-block w-4 text-center text-accent">
            {isCollapsed ? "+" : "\u2212"}
          </span>
          {section.sectionName}
          {diffCount > 0 && (
            <span className="ml-2 text-accent-dim">
              {diffCount} diff{diffCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Data rows */}
      {!isCollapsed &&
        rows.map((row, rowIndex) => {
          if (row.type === 'split') return null;
          const nextRow = rows[rowIndex + 1];
          const ratios = nextRow?.type === 'split' ? nextRow.ratios : undefined;
          return (
          <div
            key={`${section.sectionName}-${row.key}`}
            className={clsx(
              "group grid grid-cols-subgrid",
              "hover:bg-elevated/50",
              row.isDifferent && "bg-diff-bg",
            )}
            style={{ gridColumn: `span ${colCount}` }}
          >
            <div className={clsx(
              "sticky left-0 z-[2] bg-base group-hover:bg-elevated p-2 border border-border text-text-secondary whitespace-nowrap",
              row.isDifferent && "!bg-diff-row group-hover:!bg-diff-row-hover",
            )}>
              {row.key}
            </div>
            {(() => {
              const unit = row.unit ? ` ${row.unit}` : "";
              const maxDecimals = Math.max(
                0,
                ...row.values.map((v) => {
                  const s = String(v);
                  return s.includes(".") ? s.split(".")[1].length : 0;
                }),
              );
              const fmtDiff = (n: number) =>
                n
                  .toLocaleString("cs-CZ", {
                    minimumFractionDigits: maxDecimals,
                    maximumFractionDigits: maxDecimals,
                  })
                  .replace(",", ".");
              return row.values.map((val, i) => {
                const ref = row.values[0];
                const numVal = val !== null ? Number(val) : NaN;
                const numRef = ref !== null ? Number(ref) : NaN;
                const bothNumeric = i > 0 && !isNaN(numVal) && !isNaN(numRef);
                const diff = bothNumeric ? numVal - numRef : 0;
                const decimals = String(val).includes(".")
                  ? String(val).split(".")[1].length
                  : 0;
                const fmtVal = (n: number) =>
                  n
                    .toLocaleString("cs-CZ", {
                      minimumFractionDigits: decimals,
                      maximumFractionDigits: decimals,
                    })
                    .replace(",", ".");

                let cellColor = "text-text-primary";
                let diffSpan: React.ReactNode = null;
                const displayVal = !isNaN(numVal) ? fmtVal(numVal) : val;

                if (val === null) {
                  cellColor = "text-text-muted italic";
                } else if (i > 0 && row.isDifferent) {
                  if (bothNumeric) {
                    if (diff > 0) {
                      diffSpan = (
                        <span className="text-diff-positive">
                          {" "}
                          (+{fmtDiff(diff)}{unit})
                        </span>
                      );
                    } else if (diff < 0) {
                      diffSpan = (
                        <span className="text-diff-negative"> ({fmtDiff(diff)}{unit})</span>
                      );
                    }
                  } else if (String(val) !== String(ref)) {
                    cellColor = "text-accent";
                  }
                }

                return (
                  <div
                    key={i}
                    data-col={i}
                    className={clsx(
                      "p-2 border border-border whitespace-nowrap",
                      ratios && "relative",
                      ratios && (i === 0 ? "z-[3]" : "z-[1]"),
                      cellColor,
                      i === 0 && !ratios && "z-[2]",
                      i === 0 && "sticky left-[var(--param-w)] bg-base group-hover:bg-elevated",
                      i === 0 && row.isDifferent && "!bg-diff-row group-hover:!bg-diff-row-hover",
                      dragIndex !== null && dragIndex !== i && "opacity-50",
                    )}
                  >
                    {val === null ? (
                      "\u2014"
                    ) : diffSpan ? (
                      <span className="flex justify-between gap-2">
                        <span>{displayVal}{unit}</span>
                        {diffSpan}
                      </span>
                    ) : (
                      <>{displayVal}{unit}</>
                    )}
                    {ratios && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-[3] bg-base px-1 text-[10px] leading-none text-text-muted whitespace-nowrap">
                        {ratios[i] ?? "\u2014"}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        );})}
    </div>
  );
}

