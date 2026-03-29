import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComparisonResult } from "../lib/compare.ts";
import type { RangeMap } from "../lib/range-mapping.ts";
import type { RangeTriplet } from "../lib/range-parser.ts";
import { getModifier, SECTION_RENAMES } from "../lib/sanitize.ts";
import type { DiffMode } from "../lib/use-setup-editor.ts";
import { EditableCell } from "./EditableCell.tsx";
import { EditColumnHeader } from "./EditColumnHeader.tsx";
import { PopoverMenu } from "./PopoverMenu.tsx";

// Reverse of SECTION_RENAMES: display name → raw name
const SECTION_UNRENAMES: Record<string, string> = {};
for (const [raw, display] of Object.entries(SECTION_RENAMES)) {
  SECTION_UNRENAMES[display] = raw;
}

export type EditConfig = {
  columnIndex: number;
  diffRefIndex: number;
  canToggleDiffMode: boolean;
  edits: Map<string, Map<string, number | string>>;
  diffMode: DiffMode;
  rangeMap: RangeMap | null;
  onCellEdit: (section: string, key: string, displayValue: string) => void;
  onCellReset: (section: string, key: string) => void;
  onStep: (section: string, key: string, direction: 1 | -1, fine: boolean) => void;
  onToggleDiffMode: () => void;
  onDiscard: () => void;
  onSave: () => void;
  canOverwrite: boolean;
  onOverwrite: (fileName: string) => void;
  canSaveToSavedGames: boolean;
  onSaveToSavedGames: (fileName: string) => void;
};

type Props = {
  result: ComparisonResult;
  setupNames: string[];
  onRemoveSetup: (index: number) => void;
  onSaveSetup: (index: number) => void;
  onReorderSetup: (from: number, to: number) => void;
  diffsOnly: boolean;
  editConfig?: EditConfig;
  onStartEdit?: (index: number) => void;
};

export function ComparisonTable({
  result,
  setupNames,
  onRemoveSetup,
  onSaveSetup,
  onReorderSetup,
  diffsOnly,
  editConfig,
  onStartEdit,
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
  const isEditColumn = (i: number) => editConfig != null && i === editConfig.columnIndex;
  const diffRefIndex = editConfig?.diffRefIndex ?? -1;

  return (
    <div ref={containerRef} className="mx-auto w-fit">
      <div
        className="grid text-sm"
        style={
          {
            gridTemplateColumns: `auto repeat(${setupNames.length}, auto)`,
            "--param-w": `${paramColWidth}px`,
          } as React.CSSProperties
        }
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 grid grid-cols-subgrid bg-elevated text-text-secondary"
          style={{ gridColumn: `span ${colCount}` }}
        >
          <div
            ref={paramColRef}
            className="sticky left-0 z-20 border border-border bg-elevated p-2 font-medium text-[10px] text-text-muted uppercase tracking-widest"
          >
            Parameter
          </div>
          {setupNames.map((name, i) => {
            if (isEditColumn(i)) {
              return (
                <div
                  key={i}
                  role="columnheader"
                  tabIndex={-1}
                  className="whitespace-nowrap border border-border bg-accent/5 p-2"
                >
                  <EditColumnHeader
                    name={name}
                    diffMode={editConfig?.diffMode ?? "vs-reference"}
                    onToggleDiffMode={editConfig?.onToggleDiffMode ?? (() => {})}
                    onDiscard={editConfig?.onDiscard ?? (() => {})}
                    onSave={editConfig?.onSave ?? (() => {})}
                    canOverwrite={editConfig?.canOverwrite ?? false}
                    onOverwrite={editConfig?.onOverwrite ?? (() => {})}
                    canSaveToSavedGames={editConfig?.canSaveToSavedGames ?? false}
                    onSaveToSavedGames={editConfig?.onSaveToSavedGames ?? (() => {})}
                    canToggleDiffMode={editConfig?.canToggleDiffMode ?? false}
                  />
                </div>
              );
            }

            return (
              <div
                key={i}
                role="columnheader"
                tabIndex={-1}
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  dragIndexRef.current = i;
                  e.dataTransfer.effectAllowed = "move";

                  const container = containerRef.current;
                  if (container) {
                    const ghost = document.createElement("div");
                    ghost.className = "text-sm";
                    for (const cell of container.querySelectorAll(`[data-col="${i}"]`)) {
                      ghost.appendChild(cell.cloneNode(true));
                    }
                    ghost.style.position = "absolute";
                    ghost.style.top = "-9999px";
                    ghost.style.left = "-9999px";
                    document.body.appendChild(ghost);
                    ghostRef.current = ghost;

                    const rect = e.currentTarget.getBoundingClientRect();
                    e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
                  }
                }}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={handleDrop}
                onDragEnd={clearDragState}
                className={clsx(
                  "cursor-grab whitespace-nowrap border p-2",
                  i === diffRefIndex ? "border-border border-t-2 border-t-accent" : "border-border",
                  i === 0 && "sticky left-[var(--param-w)] z-20 bg-elevated",
                  dragIndex !== null && dragIndex !== i && "opacity-50",
                )}
              >
                <PopoverMenu
                  label={
                    <span className="truncate text-text-primary" title={name}>
                      {name.replace(/\.lsp$/, "")}
                    </span>
                  }
                  className="flex items-center justify-between gap-2"
                  disabled={dragIndex !== null}
                >
                  {onStartEdit && (
                    <>
                      <PopoverMenu.Item onClick={() => onStartEdit(i)} variant="accent">
                        Edit
                      </PopoverMenu.Item>
                      <PopoverMenu.Divider />
                    </>
                  )}
                  <PopoverMenu.Item onClick={() => onSaveSetup(i)}>Download</PopoverMenu.Item>
                  <PopoverMenu.Divider />
                  <PopoverMenu.Item onClick={() => onRemoveSetup(i)} variant="danger">
                    Remove
                  </PopoverMenu.Item>
                </PopoverMenu>
              </div>
            );
          })}
        </div>

        {/* Sections */}
        {result.map((section) => {
          const visibleRows = diffsOnly
            ? section.rows.filter((r, i, arr) => {
                if (r.type === "split") {
                  const prev = arr[i - 1];
                  const next = arr[i + 1];
                  return (
                    prev?.type === "data" &&
                    prev.isDifferent &&
                    next?.type === "data" &&
                    next.isDifferent
                  );
                }
                return r.isDifferent;
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
              editConfig={editConfig}
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
  editConfig,
}: {
  section: ComparisonResult[number];
  rows: ComparisonResult[number]["rows"];
  colCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  dragIndex: number | null;
  editConfig?: EditConfig;
}) {
  const diffCount = section.rows.filter((r) => r.type === "data" && r.isDifferent).length;

  return (
    <div className="grid grid-cols-subgrid" style={{ gridColumn: `span ${colCount}` }}>
      {/* Section header */}
      <div
        role="button"
        tabIndex={-1}
        className="sticky top-[37px] z-[8] cursor-pointer select-none border border-border bg-elevated hover:bg-[#2e2e28]"
        style={{ gridColumn: `span ${colCount}` }}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
      >
        <div className="sticky left-0 w-fit whitespace-nowrap border-l-accent p-2 font-medium text-text-primary text-xs uppercase tracking-wider">
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
          if (row.type === "split") return null;
          const nextRow = rows[rowIndex + 1];
          const ratios = nextRow?.type === "split" ? nextRow.ratios : undefined;
          return (
            <div
              key={`${section.sectionName}-${row.key}`}
              className={clsx("group grid grid-cols-subgrid", "hover:bg-elevated/50")}
              style={{ gridColumn: `span ${colCount}` }}
            >
              <div
                className={clsx(
                  "sticky left-0 z-[2] whitespace-nowrap border border-border bg-base p-2 text-text-secondary group-hover:bg-elevated",
                )}
              >
                {row.key}
              </div>
              {(() => {
                const unit = row.unit ? ` ${row.unit}` : "";
                const maxDecimals = Math.max(
                  0,
                  ...row.values.map((v, i) => {
                    if (editConfig != null && i === editConfig.columnIndex) return 0;
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
                  const isEdit = editConfig != null && i === editConfig.columnIndex;

                  // Reference column: for the edit column use the pre-computed diffRefIndex,
                  // for regular columns always compare against column 0.
                  const refIndex = isEdit ? (editConfig?.diffRefIndex ?? 0) : 0;

                  const ref = row.values[refIndex];
                  const numVal = val !== null ? Number(val) : NaN;
                  const numRef = ref !== null ? Number(ref) : NaN;
                  const bothNumeric = i > 0 && !Number.isNaN(numVal) && !Number.isNaN(numRef);
                  const diff = bothNumeric ? numVal - numRef : 0;
                  const decimals = String(val).includes(".") ? String(val).split(".")[1].length : 0;
                  const fmtVal = (n: number) =>
                    n
                      .toLocaleString("cs-CZ", {
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals,
                      })
                      .replace(",", ".");

                  // Check if this cell is edited (edits map uses raw section names)
                  const rawSection = SECTION_UNRENAMES[section.sectionName] ?? section.sectionName;
                  const isEdited =
                    isEdit && editConfig?.edits.get(rawSection)?.has(row.key) === true;

                  if (isEdit) {
                    // Look up range for this row and convert to display units
                    let displayRange: RangeTriplet | undefined;
                    if (editConfig?.rangeMap) {
                      const rawSection =
                        SECTION_UNRENAMES[section.sectionName] ?? section.sectionName;
                      const rawRange = editConfig.rangeMap.get(rawSection)?.get(row.key);
                      if (rawRange) {
                        const mod = getModifier(row.key);
                        displayRange = {
                          min: rawRange.min * mod,
                          max: rawRange.max * mod,
                          step: rawRange.step * mod,
                        };
                      }
                    }

                    return (
                      <div
                        key={i}
                        data-col={i}
                        data-testid={`edit-cell-${section.sectionName}-${row.key}`}
                        className={clsx(
                          "cursor-text whitespace-nowrap border",
                          isEdited ? "border-accent/40" : "border-border",
                          ratios && "relative",
                          ratios && "z-[1]",
                        )}
                      >
                        <EditableCell
                          value={val}
                          unit={row.unit}
                          range={displayRange}
                          fallbackStep={
                            displayRange
                              ? undefined
                              : (() => {
                                  let maxDec = 0;
                                  for (const v of row.values) {
                                    if (v === null) continue;
                                    const s = String(v);
                                    const d = s.includes(".") ? s.split(".")[1].length : 0;
                                    if (d > maxDec) maxDec = d;
                                  }
                                  return 10 ** -maxDec;
                                })()
                          }
                          refValue={numRef}
                          maxDecimals={maxDecimals}
                          onCommit={(displayValue) => {
                            editConfig?.onCellEdit(section.sectionName, row.key, displayValue);
                          }}
                          onReset={() => {
                            editConfig?.onCellReset(section.sectionName, row.key);
                          }}
                          onStep={(direction, fine) =>
                            editConfig?.onStep(section.sectionName, row.key, direction, fine)
                          }
                        />
                        {ratios && (
                          <span className="absolute bottom-0 left-1/2 z-[3] -translate-x-1/2 translate-y-1/2 whitespace-nowrap bg-base px-1 text-[11px] text-text-muted leading-none">
                            {ratios[i] ?? "\u2014"}
                          </span>
                        )}
                      </div>
                    );
                  }

                  let cellColor = "text-text-primary";
                  let diffSpan: React.ReactNode = null;
                  const displayVal = !Number.isNaN(numVal) ? fmtVal(numVal) : val;

                  if (val === null) {
                    cellColor = "text-text-muted italic";
                  } else if (i > 0 && row.isDifferent) {
                    if (bothNumeric) {
                      if (diff > 0) {
                        diffSpan = (
                          <span className="text-diff-positive">
                            {" "}
                            (+{fmtDiff(diff)}
                            {unit})
                          </span>
                        );
                      } else if (diff < 0) {
                        diffSpan = (
                          <span className="text-diff-negative">
                            {" "}
                            ({fmtDiff(diff)}
                            {unit})
                          </span>
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
                        "whitespace-nowrap border border-border p-2",
                        ratios && "relative",
                        ratios && (i === 0 ? "z-[3]" : "z-[1]"),
                        cellColor,
                        i === 0 && !ratios && "z-[2]",
                        i === 0 && "sticky left-[var(--param-w)] bg-base group-hover:bg-elevated",
                        dragIndex !== null && dragIndex !== i && "opacity-50",
                      )}
                    >
                      {val === null ? (
                        "\u2014"
                      ) : diffSpan ? (
                        <span className="flex justify-between gap-2">
                          <span>
                            {displayVal}
                            {unit}
                          </span>
                          {diffSpan}
                        </span>
                      ) : (
                        <>
                          {displayVal}
                          {unit}
                        </>
                      )}
                      {ratios && (
                        <span className="absolute bottom-0 left-1/2 z-[3] -translate-x-1/2 translate-y-1/2 whitespace-nowrap bg-base px-1 text-[11px] text-text-muted leading-none">
                          {ratios[i] ?? "\u2014"}
                        </span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          );
        })}
    </div>
  );
}
