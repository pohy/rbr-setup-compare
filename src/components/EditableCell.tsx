import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  value: number | string | null;
  unit?: string;
  onCommit: (value: string) => void;
};

export function EditableCell({ value, unit, onCommit }: Props) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (trimmed !== "" && trimmed !== String(value)) {
      onCommit(trimmed);
    }
  }, [inputValue, value, onCommit]);

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

  const unitSuffix = unit ? ` ${unit}` : "";
  const displayText = value === null ? "\u2014" : `${value}${unitSuffix}`;

  return (
    <div
      onClick={() => {
        if (!editing) startEditing();
      }}
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ")) startEditing();
      }}
      role="button"
      tabIndex={0}
      className="cursor-text select-none h-full relative"
    >
      {/* Always-present text to hold size */}
      <span className={editing ? "invisible" : undefined}>{displayText}</span>
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
