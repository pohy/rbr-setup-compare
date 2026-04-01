// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { Mock } from "vitest";
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
  type OnStep = NonNullable<ComponentProps<typeof EditableCell>["onStep"]>;
  function renderSteppable(overrides?: { value?: number; onStep?: Mock<OnStep> }) {
    const onStep = overrides?.onStep ?? vi.fn<OnStep>();
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

describe("EditableCell arrow-key stepping (draft mode)", () => {
  const RANGE = { min: 0, max: 100, step: 5 };

  beforeEach(() => {
    HTMLElement.prototype.requestPointerLock = vi.fn();
    document.exitPointerLock = vi.fn();
  });

  /** Render with onStep and open the text input via center-zone click. */
  function openInput(value: number, range?: typeof RANGE, fallbackStep?: number) {
    const onCommit = vi.fn();
    render(
      <EditableCell
        value={value}
        unit="kN/m"
        range={range}
        fallbackStep={fallbackStep}
        onCommit={onCommit}
        onStep={() => {}}
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
    // Click center zone to open text input
    fireEvent.mouseDown(cell, { button: 0, clientX: 150, clientY: 15 });
    fireEvent.mouseUp(cell, { button: 0, clientX: 150, clientY: 15 });
    return { input: screen.getByRole("textbox"), onCommit };
  }

  it("ArrowUp increments value in the input", () => {
    const { input } = openInput(50, RANGE);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("55");
  });

  it("ArrowDown decrements value in the input", () => {
    const { input } = openInput(50, RANGE);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("45");
  });

  it("Shift+ArrowUp uses fine step", () => {
    const { input } = openInput(50, RANGE);
    fireEvent.keyDown(input, { key: "ArrowUp", shiftKey: true });
    expect(input).toHaveValue("50.5");
  });

  it("does not commit on arrow key (draft mode)", () => {
    const { input, onCommit } = openInput(50, RANGE);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does nothing for non-numeric input text", () => {
    const { input } = openInput(50, RANGE);
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("abc");
  });

  it("steps without range using decimal-derived step", () => {
    const { input } = openInput(1.5);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("1.6");
  });

  it("uses fallbackStep when provided and no range", () => {
    const { input } = openInput(50, undefined, 10);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("60");
  });
});

describe("EditableCell focus-to-edit", () => {
  beforeEach(() => {
    HTMLElement.prototype.requestPointerLock = vi.fn();
    document.exitPointerLock = vi.fn();
  });

  it("enters editing when cell receives focus", () => {
    render(<EditableCell value={50} unit="kN/m" onCommit={() => {}} />);
    const cell = screen.getByRole("button");

    fireEvent.focus(cell);

    expect(screen.getByRole("textbox")).toHaveValue("50");
  });

  it("Tab from input opens editing on the next focused cell", () => {
    render(
      <>
        <EditableCell value={50} unit="kN/m" onCommit={() => {}} />
        <EditableCell value={60} unit="kN/m" onCommit={() => {}} />
      </>,
    );
    const [cell1, cell2] = screen.getAllByRole("button");

    // Open editing on cell1
    fireEvent.click(cell1);
    const input = screen.getByRole("textbox");

    // Simulate Tab: blur → focus on next cell
    fireEvent.blur(input);
    fireEvent.focus(cell2);

    expect(screen.getByRole("textbox")).toHaveValue("60");
  });

  it("Shift+Tab from input opens editing on the previous focused cell", () => {
    render(
      <>
        <EditableCell value={50} unit="kN/m" onCommit={() => {}} />
        <EditableCell value={60} unit="kN/m" onCommit={() => {}} />
      </>,
    );
    const [cell1, cell2] = screen.getAllByRole("button");

    // Open editing on cell2
    fireEvent.click(cell2);
    const input = screen.getByRole("textbox");

    // Simulate Shift+Tab: blur → focus on prev cell
    fireEvent.blur(input);
    fireEvent.focus(cell1);

    expect(screen.getByRole("textbox")).toHaveValue("50");
  });

  it("commits current value when focus moves away", () => {
    const onCommit = vi.fn();
    render(
      <>
        <EditableCell value={50} unit="kN/m" onCommit={onCommit} />
        <EditableCell value={60} unit="kN/m" onCommit={() => {}} />
      </>,
    );
    const [cell1, cell2] = screen.getAllByRole("button");

    fireEvent.click(cell1);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "55" } });

    fireEvent.blur(input);
    fireEvent.focus(cell2);

    expect(onCommit).toHaveBeenCalledWith("55");
  });
});

describe("EditableCell diff display", () => {
  beforeEach(() => {
    HTMLElement.prototype.requestPointerLock = vi.fn();
    document.exitPointerLock = vi.fn();
  });

  function renderWithDiff(value: number, refValue: number, unit = " kN/m") {
    render(
      <EditableCell
        value={value}
        unit={unit.trim()}
        refValue={refValue}
        maxDecimals={0}
        onCommit={() => {}}
        onStep={() => {}}
      />,
    );
    return screen.getByRole("button");
  }

  function openInputWithDiff(value: number, refValue: number) {
    render(
      <EditableCell
        value={value}
        unit="kN/m"
        refValue={refValue}
        maxDecimals={0}
        onCommit={() => {}}
        onStep={() => {}}
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
    fireEvent.mouseDown(cell, { button: 0, clientX: 150, clientY: 15 });
    fireEvent.mouseUp(cell, { button: 0, clientX: 150, clientY: 15 });
    return screen.getByRole("textbox");
  }

  it("shows positive diff in display mode", () => {
    const cell = renderWithDiff(55, 50);
    expect(cell).toHaveTextContent(/\+5/);
  });

  it("shows negative diff in display mode", () => {
    const cell = renderWithDiff(45, 50);
    expect(cell).toHaveTextContent(/-5/);
  });

  it("shows no diff when values are equal", () => {
    const cell = renderWithDiff(50, 50);
    expect(cell).not.toHaveTextContent(/[+-]/);
  });

  it("shows live diff during editing", () => {
    const input = openInputWithDiff(55, 50);
    // Diff should be visible somewhere in the cell even during editing
    const cell = input.closest("[role=button]") as HTMLElement;
    expect(cell).toHaveTextContent(/\+5/);
  });

  it("updates diff as input value changes", () => {
    const input = openInputWithDiff(55, 50);
    fireEvent.change(input, { target: { value: "60" } });
    const cell = input.closest("[role=button]") as HTMLElement;
    expect(cell).toHaveTextContent(/\+10/);
  });

  it("renders diff inside the value flex container, not absolutely positioned", () => {
    const cell = renderWithDiff(55, 50);
    const diffEl = cell.querySelector(".text-diff-positive, .text-diff-negative");
    expect(diffEl).toBeInTheDocument();
    // The diff wrapper must NOT be absolutely positioned (causes overlap with value)
    const diffWrapper = diffEl?.parentElement;
    expect(diffWrapper?.className).not.toContain("absolute");
    // Value and diff should be siblings inside the same flex container
    const valueSpan = cell.querySelector("span.flex");
    expect(valueSpan).toBeInTheDocument();
    expect(diffWrapper?.closest(".flex")).toBe(valueSpan);
  });

  it("dims diff when input is non-numeric", () => {
    const input = openInputWithDiff(55, 50);
    fireEvent.change(input, { target: { value: "abc" } });
    const cell = input.closest("[role=button]") as HTMLElement;
    // Should still show the last valid diff but dimmed
    const diffEl = cell.querySelector("[data-stale-diff]");
    expect(diffEl).toBeInTheDocument();
    expect(diffEl).toHaveTextContent(/\+5/);
  });
});

describe("EditableCell range fill", () => {
  const RANGE = { min: 0, max: 100, step: 5 };

  beforeEach(() => {
    HTMLElement.prototype.requestPointerLock = vi.fn();
    document.exitPointerLock = vi.fn();
  });

  function renderWithRange(value: number) {
    render(
      <EditableCell
        value={value}
        unit="kN/m"
        range={RANGE}
        onCommit={() => {}}
        onStep={() => {}}
      />,
    );
    return screen.getByRole("button");
  }

  function openInputWithRange(value: number) {
    const cell = renderWithRange(value);
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
    fireEvent.mouseDown(cell, { button: 0, clientX: 150, clientY: 15 });
    fireEvent.mouseUp(cell, { button: 0, clientX: 150, clientY: 15 });
    return { cell, input: screen.getByRole("textbox") };
  }

  it("shows fill background based on value position in range", () => {
    const cell = renderWithRange(50);
    expect(cell.style.background).toContain("50%");
  });

  it("shows no fill when range is absent", () => {
    render(<EditableCell value={50} unit="kN/m" onCommit={() => {}} />);
    const cell = screen.getByRole("button");
    expect(cell.style.background).toBe("");
  });

  it("updates fill live during editing", () => {
    const { cell, input } = openInputWithRange(50);
    fireEvent.change(input, { target: { value: "75" } });
    expect(cell.style.background).toContain("75%");
  });

  it("dims fill when input is non-numeric (stale)", () => {
    const { cell, input } = openInputWithRange(50);
    fireEvent.change(input, { target: { value: "abc" } });
    // Should still show fill at last valid position
    expect(cell.style.background).toContain("50%");
    expect(cell.querySelector("[data-stale-fill]")).toBeInTheDocument();
  });

  it("restores normal fill when input becomes valid again", () => {
    const { cell, input } = openInputWithRange(50);
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.change(input, { target: { value: "80" } });
    expect(cell.style.background).toContain("80%");
    expect(cell.querySelector("[data-stale-fill]")).not.toBeInTheDocument();
  });
});
