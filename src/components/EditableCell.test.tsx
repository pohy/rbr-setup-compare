// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditableCell } from "./EditableCell.tsx";

afterEach(cleanup);

describe("EditableCell", () => {
  it("renders the display value with unit", () => {
    render(<EditableCell value={50} unit="kN/m" onCommit={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("50 kN/m");
  });

  it("renders dash for null value", () => {
    render(<EditableCell value={null} onCommit={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("\u2014");
  });

  it("switches to input on click", () => {
    render(<EditableCell value={50} unit="kN/m" onCommit={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("textbox")).toHaveValue("50");
  });

  it("commits on Enter", () => {
    const onCommit = vi.fn();
    render(<EditableCell value={50} unit="kN/m" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "55" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("55");
  });

  it("commits on blur", () => {
    const onCommit = vi.fn();
    render(<EditableCell value={50} unit="kN/m" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "55" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith("55");
  });

  it("reverts on Escape without committing", () => {
    const onCommit = vi.fn();
    render(<EditableCell value={50} unit="kN/m" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "55" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    // Should be back to display mode
    expect(screen.getByRole("button")).toHaveTextContent("50 kN/m");
  });

  it("does not commit if value unchanged", () => {
    const onCommit = vi.fn();
    render(<EditableCell value={50} unit="kN/m" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    // Value stays "50", hit Enter
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("renders correctly when isEdited is true", () => {
    render(<EditableCell value={55} unit="kN/m" onCommit={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("55 kN/m");
  });

  it("calls onReset when input is cleared and committed", () => {
    const onReset = vi.fn();
    render(<EditableCell value={50} unit="kN/m" onCommit={() => {}} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onReset).toHaveBeenCalled();
  });
});

describe("EditableCell click-to-step (three-zone)", () => {
  const RANGE = { min: 0, max: 100, step: 1 };

  /** Render with onStep and mock cell bounding rect at x=0..300 (thirds at 100, 200). */
  function renderSteppable(overrides?: { value?: number; onStep?: ReturnType<typeof vi.fn> }) {
    const onStep = overrides?.onStep ?? vi.fn();
    const result = render(
      <EditableCell
        value={overrides?.value ?? 50}
        unit="kN/m"
        range={RANGE}
        onCommit={() => {}}
        onStep={onStep}
      />,
    );
    const cell = screen.getByRole("button");
    vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 300,
      bottom: 30,
      width: 300,
      height: 30,
      toJSON: () => {},
    });
    return { cell, onStep, ...result };
  }

  /** Fire a mouseDown + mouseUp at a given clientX (no drag movement). */
  function clickAt(
    el: HTMLElement,
    clientX: number,
    opts?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
  ) {
    fireEvent.mouseDown(el, { button: 0, clientX, clientY: 15, ...opts });
    fireEvent.mouseUp(el, { button: 0, clientX, clientY: 15, ...opts });
  }

  beforeEach(() => {
    // Pointer lock is not available in jsdom
    HTMLElement.prototype.requestPointerLock = vi.fn();
    document.exitPointerLock = vi.fn();
  });

  afterEach(cleanup);

  it("steps -1 when clicking the left third", () => {
    const { cell, onStep } = renderSteppable();
    clickAt(cell, 50); // left third (0-100)
    expect(onStep).toHaveBeenCalledWith(-1, false);
  });

  it("steps +1 when clicking the right third", () => {
    const { cell, onStep } = renderSteppable();
    clickAt(cell, 250); // right third (200-300)
    expect(onStep).toHaveBeenCalledWith(1, false);
  });

  it("passes fine=true when shift is held", () => {
    const { cell, onStep } = renderSteppable();
    clickAt(cell, 250, { shiftKey: true });
    expect(onStep).toHaveBeenCalledWith(1, true);
  });

  it("opens text input when clicking the center third", () => {
    const { cell, onStep } = renderSteppable();
    clickAt(cell, 150); // center third (100-200)
    expect(onStep).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("opens text input on ctrl+click regardless of zone", () => {
    const { cell, onStep } = renderSteppable();
    clickAt(cell, 50, { ctrlKey: true }); // left third, but ctrl held
    expect(onStep).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("opens text input on meta+click regardless of zone", () => {
    const { cell, onStep } = renderSteppable();
    clickAt(cell, 50, { metaKey: true });
    expect(onStep).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows cursor-pointer on left/right, cursor-text on center", () => {
    const { cell } = renderSteppable();
    fireEvent.mouseMove(cell, { clientX: 50, clientY: 15 });
    expect(cell.className).toContain("cursor-pointer");

    fireEvent.mouseMove(cell, { clientX: 150, clientY: 15 });
    expect(cell.className).toContain("cursor-text");

    fireEvent.mouseMove(cell, { clientX: 250, clientY: 15 });
    expect(cell.className).toContain("cursor-pointer");
  });

  it("resets cursor on mouse leave", () => {
    const { cell } = renderSteppable();
    fireEvent.mouseMove(cell, { clientX: 50, clientY: 15 });
    expect(cell.className).toContain("cursor-pointer");

    fireEvent.mouseLeave(cell);
    expect(cell.className).toContain("cursor-ew-resize");
  });
});
