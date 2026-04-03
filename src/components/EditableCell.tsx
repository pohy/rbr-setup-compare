import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RangeTriplet } from "../lib/range-parser.ts";
import { stepDraft } from "../lib/step-draft.ts";

type Props = {
  value: number | string | null;
  unit?: string;
  range?: RangeTriplet;
  fallbackStep?: number;
  refValue?: number;
  maxDecimals?: number;
  isEdited?: boolean;
  onCommit: (value: string) => void;
  onReset?: () => void;
  onStep?: (direction: 1 | -1, fine: boolean) => void;
  onEditingChange?: (editing: boolean) => void;
};

const DRAG_ENTER_THRESHOLD = 2;
const DEFAULT_DRAG_STEP_THRESHOLD = 5;
const TARGET_FULL_RANGE_PX = 400;
const MIN_PX_PER_STEP = 2;
const MAX_PX_PER_STEP = 50;

export function computeDragStepThreshold(range?: RangeTriplet): number {
  if (!range || range.step === 0 || range.max === range.min) {
    return DEFAULT_DRAG_STEP_THRESHOLD;
  }
  const totalSteps = (range.max - range.min) / range.step;
  if (totalSteps <= 0) {
    return DEFAULT_DRAG_STEP_THRESHOLD;
  }
  return Math.round(
    Math.min(MAX_PX_PER_STEP, Math.max(MIN_PX_PER_STEP, TARGET_FULL_RANGE_PX / totalSteps)),
  );
}

type HoverZone = "left" | "center" | "right";

export function EditableCell({
  value,
  unit,
  range,
  fallbackStep,
  refValue,
  maxDecimals,
  isEdited,
  onCommit,
  onReset,
  onStep,
  onEditingChange,
}: Props) {
  const [editing, setEditing] = useState(false);

  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  useEffect(() => {
    onEditingChangeRef.current?.(editing);
  }, [editing]);
  const [inputValue, setInputValue] = useState("");
  const [hoverZone, setHoverZone] = useState<HoverZone | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const lastValidDiffRef = useRef<number | null>(null);
  const lastValidFillRef = useRef<number | null>(null);

  const startEditing = useCallback(() => {
    const displayVal = value !== null ? String(value) : "";
    setInputValue(displayVal);
    setHoverZone(null);
    setEditing(true);
  }, [value]);

  const handleCommit = useCallback(
    (trimmed: string) => {
      setEditing(false);
      if (trimmed === "") {
        onReset?.();
      } else if (trimmed !== String(value)) {
        onCommit(trimmed);
      }
    },
    [value, onCommit, onReset],
  );

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleReset = useCallback(() => {
    setInputValue(value !== null ? String(value) : "");
    onReset?.();
  }, [onReset, value]);

  // Sync inputValue when value prop changes during editing (e.g. after committed edit is reset)
  useEffect(() => {
    if (editing) {
      setInputValue(value !== null ? String(value) : "");
    }
  }, [editing, value]);

  // Click-and-drag handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onStep || editing) {
        return;
      }
      if (e.button !== 0) {
        return;
      }
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startZone = cellRef.current
        ? getZone(startX, cellRef.current.getBoundingClientRect())
        : "center";
      let entered = false;
      let accumX = 0;
      let accumY = 0;
      const stepThreshold = computeDragStepThreshold(range);

      const onMouseMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        if (!entered) {
          if (Math.abs(dx) + Math.abs(dy) < DRAG_ENTER_THRESHOLD) {
            return;
          }
          entered = true;
          if (cellRef.current) {
            enterDragMode(cellRef.current);
          }
        }

        // Accumulate movement: right/up = positive
        accumX += me.movementX;
        accumY += -me.movementY;
        const total = accumX + accumY;

        if (Math.abs(total) >= stepThreshold) {
          const direction = total > 0 ? 1 : -1;
          onStep(direction as 1 | -1, me.shiftKey);
          accumX = 0;
          accumY = 0;
        }
      };

      const onMouseUp = (me: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        exitDragMode();

        if (entered) {
          return;
        }

        if (me.ctrlKey || me.metaKey || startZone === "center") {
          startEditing();
        } else {
          const direction: 1 | -1 = startZone === "left" ? -1 : 1;
          onStep(direction, me.shiftKey);
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onStep, editing, startEditing, range],
  );

  const handleHoverMove = useCallback((e: React.MouseEvent) => {
    if (!cellRef.current) {
      return;
    }
    setHoverZone(getZone(e.clientX, cellRef.current.getBoundingClientRect()));
  }, []);

  const unitSuffix = unit ? ` ${unit}` : "";
  const displayText = value === null ? "\u2014" : `${value}${unitSuffix}`;

  const titleText = range ? `${range.min} – ${range.max} (step ${range.step})` : undefined;

  const cursorClass =
    !onStep || editing
      ? "cursor-text"
      : hoverZone === "center"
        ? "cursor-text"
        : hoverZone === "left" || hoverZone === "right"
          ? "cursor-pointer"
          : "cursor-ew-resize";

  // Compute range fill (progress bar)
  const { fillPct, staleFill } = (() => {
    if (!range) {
      return { fillPct: null, staleFill: false };
    }

    const currentNum = editing ? parseFloat(inputValue) : Number(value);
    const validNum = !Number.isNaN(currentNum);

    if (validNum) {
      const pct = ((currentNum - range.min) / (range.max - range.min)) * 100;
      lastValidFillRef.current = pct;
      return { fillPct: pct, staleFill: false };
    }

    return { fillPct: lastValidFillRef.current, staleFill: true };
  })();

  const fillStyle =
    fillPct !== null
      ? {
          background: `linear-gradient(to right, oklch(0.7 0.15 85 / ${staleFill ? 0.05 : 0.12}) ${fillPct}%, transparent ${fillPct}%)`,
        }
      : undefined;

  // Compute diff against reference value
  const { diffNode, stale } = (() => {
    if (refValue == null || Number.isNaN(refValue)) {
      return { diffNode: null, stale: false };
    }

    const currentNum = editing ? parseFloat(inputValue) : Number(value);
    const validNum = !Number.isNaN(currentNum);

    if (validNum) {
      const diff = currentNum - refValue;
      lastValidDiffRef.current = diff;
      if (Math.abs(diff) < 0.0001) {
        return { diffNode: null, stale: false };
      }
      return { diffNode: formatDiffSpan(diff, maxDecimals ?? 0, unitSuffix), stale: false };
    }

    // Non-numeric input: show last valid diff dimmed
    const lastDiff = lastValidDiffRef.current;
    if (lastDiff == null || Math.abs(lastDiff) < 0.0001) {
      return { diffNode: null, stale: false };
    }
    return { diffNode: formatDiffSpan(lastDiff, maxDecimals ?? 0, unitSuffix), stale: true };
  })();

  return (
    <div
      ref={cellRef}
      onClick={
        onStep
          ? undefined
          : () => {
              if (!editing) {
                startEditing();
              }
            }
      }
      onMouseDown={onStep ? handleMouseDown : undefined}
      onMouseMove={onStep && !editing ? handleHoverMove : undefined}
      onMouseLeave={
        onStep && !editing
          ? () => {
              setHoverZone(null);
            }
          : undefined
      }
      onFocus={() => {
        if (!editing) {
          startEditing();
        }
      }}
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ")) {
          startEditing();
        }
      }}
      role="button"
      tabIndex={editing ? -1 : 0}
      title={titleText}
      className={clsx("relative h-full select-none", cursorClass)}
      style={fillStyle}
    >
      {staleFill && <span data-stale-fill hidden />}
      {onStep && !editing && hoverZone && <ZoneHint zone={hoverZone} />}
      <span className="relative z-[1] flex justify-between gap-2 p-2">
        <span className={clsx(editing && "invisible")}>{displayText}</span>
        {diffNode && (
          <span
            className={clsx("pointer-events-none shrink-0", stale && "opacity-40")}
            {...(stale ? { "data-stale-diff": true } : {})}
          >
            {diffNode}
          </span>
        )}
      </span>
      {editing && (
        <CellInput
          value={inputValue}
          onChange={setInputValue}
          onCommit={handleCommit}
          onCancel={handleCancel}
          range={range}
          fallbackStep={fallbackStep}
          padRight={!!diffNode}
        />
      )}
      {!!onReset &&
        (!!isEdited || (editing && inputValue !== (value !== null ? String(value) : ""))) && (
          <button
            type="button"
            title="Reset"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseEnter={() => setHoverZone(null)}
            onClick={handleReset}
            className={clsx(
              "absolute top-1/2 -right-10 z-[2] flex h-10 w-10 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-text-muted hover:text-text-primary",
              editing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M2 8a6 6 0 1 1 1.76 4.24l1.42-1.42A4 4 0 1 0 4 8h2L3 11 0 8h2z" />
            </svg>
          </button>
        )}
    </div>
  );
}

function formatDiffSpan(diff: number, maxDecimals: number, unitSuffix: string) {
  const formatted = diff
    .toLocaleString("cs-CZ", {
      minimumFractionDigits: maxDecimals,
      maximumFractionDigits: maxDecimals,
    })
    .replace(",", ".");
  const cls = diff > 0 ? "text-diff-positive" : "text-diff-negative";
  return (
    <span className={cls}>
      ({diff > 0 ? "+" : ""}
      {formatted}
      {unitSuffix})
    </span>
  );
}

function getZone(clientX: number, rect: DOMRect): HoverZone {
  const third = rect.width / 3;
  const rel = clientX - rect.left;
  if (rel < third) {
    return "left";
  }
  if (rel > third * 2) {
    return "right";
  }
  return "center";
}

let dragStyleEl: HTMLStyleElement | null = null;

function enterDragMode(el: HTMLElement) {
  if (dragStyleEl) {
    return;
  }
  dragStyleEl = document.createElement("style");
  dragStyleEl.textContent = "* { pointer-events: none !important; }";
  document.head.appendChild(dragStyleEl);
  el.requestPointerLock();
}

function exitDragMode() {
  if (dragStyleEl) {
    dragStyleEl.remove();
    dragStyleEl = null;
  }
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}

function ZoneHint({ zone }: { zone: HoverZone }) {
  if (zone === "center") {
    const accentColor = "var(--color-accent)";
    const style = {
      background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`,
    };
    return (
      <>
        <span className="pointer-events-none absolute -top-px left-1/5 h-0.5 w-3/5" style={style} />
        <span
          className="pointer-events-none absolute -bottom-px left-1/5 h-0.5 w-3/5"
          style={style}
        />
      </>
    );
  }

  const isLeft = zone === "left";
  const color = isLeft ? "var(--color-diff-negative)" : "var(--color-diff-positive)";
  const gradDir = isLeft ? "to right" : "to left";
  const hBarStyle = { background: `linear-gradient(${gradDir}, ${color}, transparent)` };
  const side = isLeft ? "-left-px" : "-right-px";

  return (
    <>
      <span
        className={clsx("pointer-events-none absolute w-0.5", side)}
        style={{ background: color, top: -1, bottom: -1 }}
      />
      <span
        className={clsx("pointer-events-none absolute -top-px h-0.5 w-2/5", side)}
        style={hBarStyle}
      />
      <span
        className={clsx("pointer-events-none absolute -bottom-px h-0.5 w-2/5", side)}
        style={hBarStyle}
      />
      <span
        className={clsx(
          "pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 rounded bg-base/90 px-0.5 text-lg leading-none",
          isLeft ? "-left-px -translate-x-1/2" : "-right-px translate-x-1/2",
        )}
        style={{ color }}
      >
        {isLeft ? "−" : "+"}
      </span>
    </>
  );
}

function CellInput({
  value,
  onChange,
  onCommit,
  onCancel,
  range,
  fallbackStep,
  padRight,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: (trimmed: string) => void;
  onCancel: () => void;
  range?: RangeTriplet;
  fallbackStep?: number;
  padRight?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit(value.trim());
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const direction: 1 | -1 = e.key === "ArrowUp" ? 1 : -1;
        const result = stepDraft(value, direction, e.shiftKey, range, fallbackStep);
        if (result !== null) {
          onChange(result);
          requestAnimationFrame(() => inputRef.current?.select());
        }
      }
    },
    [value, onCommit, onCancel, range, fallbackStep, onChange],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value.trim())}
      onKeyDown={handleKeyDown}
      autoComplete="off"
      className={clsx(
        "absolute inset-0 border-accent/60 border-b bg-transparent p-2 text-sm text-text-primary outline-none",
        padRight && "pr-20",
      )}
    />
  );
}
