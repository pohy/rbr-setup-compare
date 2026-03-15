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

export function EditableCell({ value, unit, range, onCommit, onReset, onStep, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    const displayVal = value !== null ? String(value) : "";
    setInputValue(displayVal);
    setEditing(true);
  }, [value]);

  const commitValue = useCallback(() => {
    setEditing(false);
    const trimmed = inputValue.trim();
    if (trimmed === "") {
      onReset?.();
    } else if (trimmed !== String(value)) {
      onCommit(trimmed);
    }
  }, [inputValue, value, onCommit, onReset]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitValue();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditing();
      }
    },
    [commitValue, cancelEditing],
  );

  // Click-and-drag handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onStep || editing) return;
      if (e.button !== 0) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
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

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        exitDragMode();

        if (!entered) {
          // Was a click, not a drag — start text editing
          startEditing();
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onStep, editing, startEditing],
  );

  const unitSuffix = unit ? ` ${unit}` : "";
  const displayText = value === null ? "\u2014" : `${value}${unitSuffix}`;

  const titleText = range ? `${range.min} – ${range.max} (step ${range.step})` : undefined;

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
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ")) startEditing();
      }}
      role="button"
      tabIndex={0}
      title={titleText}
      className={`select-none h-full relative ${onStep ? "cursor-ew-resize" : "cursor-text"}`}
    >
      {/* Always-present text to hold size */}
      <span className={`flex justify-between gap-2 ${editing ? "invisible" : ""}`}>
        <span>{displayText}</span>
        {children}
      </span>
      {/* Input overlaid when editing */}
      {editing && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 bg-transparent outline-none text-text-primary text-sm border-b border-accent/60"
        />
      )}
    </div>
  );
}
