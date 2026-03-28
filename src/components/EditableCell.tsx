import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RangeTriplet } from "../lib/range-parser.ts";

type Props = {
  value: number | string | null;
  unit?: string;
  range?: RangeTriplet;
  onCommit: (value: string) => void;
  onReset?: () => void;
  onStep?: (direction: 1 | -1, fine: boolean) => void;
  children?: React.ReactNode;
};

const DRAG_ENTER_THRESHOLD = 2;
const DRAG_STEP_THRESHOLD = 3;

type HoverZone = "left" | "center" | "right";

export function EditableCell({ value, unit, range, onCommit, onReset, onStep, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hoverZone, setHoverZone] = useState<HoverZone | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  const startEditing = useCallback(() => {
    const displayVal = value !== null ? String(value) : "";
    setInputValue(displayVal);
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

  // Click-and-drag handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onStep || editing) return;
      if (e.button !== 0) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startZone = cellRef.current
        ? getZone(startX, cellRef.current.getBoundingClientRect())
        : "center";
      let entered = false;
      let accumX = 0;
      let accumY = 0;

      const onMouseMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        if (!entered) {
          if (Math.abs(dx) + Math.abs(dy) < DRAG_ENTER_THRESHOLD) return;
          entered = true;
          if (cellRef.current) enterDragMode(cellRef.current);
        }

        // Accumulate movement: right/up = positive
        accumX += me.movementX;
        accumY += -me.movementY;
        const total = accumX + accumY;

        if (Math.abs(total) >= DRAG_STEP_THRESHOLD) {
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
    [onStep, editing, startEditing],
  );

  const handleHoverMove = useCallback((e: React.MouseEvent) => {
    if (!cellRef.current) return;
    setHoverZone(getZone(e.clientX, cellRef.current.getBoundingClientRect()));
  }, []);

  const handleHoverLeave = useCallback(() => {
    setHoverZone(null);
  }, []);

  const unitSuffix = unit ? ` ${unit}` : "";
  const displayText = value === null ? "\u2014" : `${value}${unitSuffix}`;

  const titleText = range ? `${range.min} – ${range.max} (step ${range.step})` : undefined;

  const cursorClass = !onStep
    ? "cursor-text"
    : hoverZone === "center"
      ? "cursor-text"
      : hoverZone === "left" || hoverZone === "right"
        ? "cursor-pointer"
        : "cursor-ew-resize";

  return (
    <div
      ref={cellRef}
      onClick={
        onStep
          ? undefined
          : () => {
              if (!editing) startEditing();
            }
      }
      onMouseDown={onStep ? handleMouseDown : undefined}
      onMouseMove={onStep && !editing ? handleHoverMove : undefined}
      onMouseLeave={onStep && !editing ? handleHoverLeave : undefined}
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ")) startEditing();
      }}
      role="button"
      tabIndex={0}
      title={titleText}
      className={clsx("relative h-full select-none", cursorClass)}
    >
      {onStep && !editing && hoverZone && <ZoneHint zone={hoverZone} />}
      <span
        className={clsx("relative z-[1] flex justify-between gap-2 p-2", editing && "invisible")}
      >
        <span>{displayText}</span>
        {children}
      </span>
      {editing && (
        <CellInput
          value={inputValue}
          onChange={setInputValue}
          onCommit={handleCommit}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

function getZone(clientX: number, rect: DOMRect): HoverZone {
  const third = rect.width / 3;
  const rel = clientX - rect.left;
  if (rel < third) return "left";
  if (rel > third * 2) return "right";
  return "center";
}

let dragStyleEl: HTMLStyleElement | null = null;

function enterDragMode(el: HTMLElement) {
  if (dragStyleEl) return;
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
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: (trimmed: string) => void;
  onCancel: () => void;
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
      }
    },
    [value, onCommit, onCancel],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value.trim())}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 border-accent/60 border-b bg-transparent p-2 text-sm text-text-primary outline-none"
    />
  );
}
