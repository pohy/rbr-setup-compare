// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { ComparisonResult } from "../lib/compare.ts";
import { ComparisonTable, type EditConfig } from "./ComparisonTable.tsx";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

const noop = () => {};

function makeEditConfig(overrides: Partial<EditConfig> = {}): EditConfig {
  return {
    columnIndex: 2,
    diffRefIndex: 0,
    canToggleDiffMode: false,
    edits: new Map(),
    diffMode: "vs-original",
    rangeMap: null,
    onCellEdit: noop,
    onCellReset: noop,
    onStep: noop,
    onToggleDiffMode: noop,
    onDiscard: noop,
    onSave: noop,
    canOverwrite: false,
    onOverwrite: noop,
    canSaveToSavedGames: false,
    onSaveToSavedGames: noop,
    ...overrides,
  };
}

function openEditPopover() {
  const editHeader = screen.getByRole("columnheader", { name: /edited/i });
  const dotsButton = editHeader.querySelector("button[title='Actions']");
  if (!dotsButton) {
    throw new Error("Actions button not found in edit column header");
  }
  fireEvent.click(dotsButton);
}

describe("ComparisonTable diff mode toggle", () => {
  it("enables toggle when canToggleDiffMode is true (source is not first)", () => {
    const result: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [{ type: "data", key: "RPM", values: [5000, 5000, 5000], isDifferent: false }],
      },
    ];

    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({ canToggleDiffMode: true, diffRefIndex: 1, columnIndex: 2 })}
      />,
    );

    openEditPopover();

    const toggleButton = screen.getByRole("button", { name: /compare vs/i });
    expect(toggleButton).not.toBeDisabled();
  });

  it("disables toggle when canToggleDiffMode is false", () => {
    const result: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [{ type: "data", key: "RPM", values: [5000, 5000], isDifferent: false }],
      },
    ];

    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({ canToggleDiffMode: false, columnIndex: 1 })}
      />,
    );

    openEditPopover();

    const toggleButton = screen.getByRole("button", { name: /compare vs/i });
    expect(toggleButton).toBeDisabled();
  });
});

describe("ComparisonTable diff calculation uses diffRefIndex", () => {
  // Editing first setup (sourceIndex=0): toggle disabled, always diffs against col 0
  it("editing first setup: toggle disabled, diffs against column 0", () => {
    const result: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [{ type: "data", key: "Power", values: [100, 200, 150], isDifferent: true }],
      },
    ];

    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          diffRefIndex: 0,
          canToggleDiffMode: false,
          columnIndex: 2,
          diffMode: "vs-original",
        })}
      />,
    );

    // diff = 150 - 100 = +50
    const editCol = screen.getByTestId("edit-cell-Engine-Power");
    expect(editCol.textContent).toContain("50");
    expect(editCol.textContent).not.toContain("-50");

    // Toggle should be disabled
    openEditPopover();
    const toggleButton = screen.getByRole("button", { name: /compare vs/i });
    expect(toggleButton).toBeDisabled();
  });

  // setups: [A=100, B=200], edited_B=250
  const resultSourceSecond: ComparisonResult = [
    {
      sectionName: "Engine",
      rows: [{ type: "data", key: "Power", values: [100, 200, 250], isDifferent: true }],
    },
  ];

  it("vs-original editing second setup: diffRefIndex=1 compares against column 1", () => {
    render(
      <ComparisonTable
        result={resultSourceSecond}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          diffRefIndex: 1,
          canToggleDiffMode: true,
          columnIndex: 2,
          diffMode: "vs-original",
        })}
      />,
    );

    // diff = 250 - 200 = +50
    const editCol = screen.getByTestId("edit-cell-Engine-Power");
    expect(editCol.textContent).toContain("50");
    expect(editCol.textContent).not.toContain("-50");
    expect(editCol.textContent).not.toContain("150");
  });

  it("vs-reference editing second setup: diffRefIndex=0 compares against column 0", () => {
    render(
      <ComparisonTable
        result={resultSourceSecond}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          diffRefIndex: 0,
          canToggleDiffMode: true,
          columnIndex: 2,
          diffMode: "vs-reference",
        })}
      />,
    );

    // diff = 250 - 100 = +150
    const editCol = screen.getByTestId("edit-cell-Engine-Power");
    expect(editCol.textContent).toContain("150");
  });
});

describe("ComparisonTable header accent border", () => {
  it("applies accent border to the column matching diffRefIndex", () => {
    const result: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [{ type: "data", key: "Power", values: [100, 200, 150], isDifferent: true }],
      },
    ];

    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          diffRefIndex: 1,
          canToggleDiffMode: true,
          columnIndex: 2,
          diffMode: "vs-reference",
        })}
      />,
    );

    const headers = screen.getAllByRole("columnheader");
    // headers: [setup1 (i=0), setup2 (i=1), edited (i=2)]
    // diffRefIndex=1 → setup2 should have accent border
    expect(headers[1].className).toContain("border-t-accent");
    expect(headers[0].className).not.toContain("border-t-accent");
  });
});

describe("ComparisonTable diff decimal precision", () => {
  it("uses edit column precision for diff when it is the most granular", () => {
    const result: ComparisonResult = [
      {
        sectionName: "VehicleControlUnit",
        rows: [
          { type: "data", key: "RearDiffThrottle_00", values: [0.4, 0.6, 0.45], isDifferent: true },
        ],
      },
    ];

    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          diffRefIndex: 0,
          canToggleDiffMode: false,
          columnIndex: 2,
          diffMode: "vs-original",
        })}
      />,
    );

    // diff = 0.45 - 0.4 = 0.05, must show with 2 decimal places
    const editCol = screen.getByTestId("edit-cell-VehicleControlUnit-RearDiffThrottle_00");
    expect(editCol.textContent).toContain("0.05");
  });
});

describe("ComparisonTable diffs-only keeps row while editing", () => {
  const sharedProps = {
    setupNames: ["setup1", "setup2", "edited"],
    onRemoveSetup: noop,
    onSaveSetup: noop,
    onReorderSetup: noop,
    diffsOnly: true,
    editConfig: makeEditConfig({ columnIndex: 2, diffRefIndex: 0, diffMode: "vs-original" }),
  } as const;

  it("keeps row visible when isDifferent becomes false while cell is being edited", () => {
    const diffResult: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [{ type: "data", key: "Power", values: [100, 100, 120], isDifferent: true }],
      },
    ];

    const { rerender } = render(<ComparisonTable result={diffResult} {...sharedProps} />);

    // Row is visible, enter edit mode on the edit cell
    const editCellWrapper = screen.getByTestId("edit-cell-Engine-Power");
    const cell = editCellWrapper.querySelector("[role=button]") as HTMLElement;
    fireEvent.focus(cell);
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    // Simulate reset: values now match, isDifferent=false
    const noDiffResult: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [{ type: "data", key: "Power", values: [100, 100, 100], isDifferent: false }],
      },
    ];

    rerender(<ComparisonTable result={noDiffResult} {...sharedProps} />);

    // Row should still be visible because the cell is being edited
    expect(screen.getByTestId("edit-cell-Engine-Power")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

describe("ComparisonTable single-setup edge case", () => {
  it("diffs against column 0 when only one setup loaded", () => {
    const result: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [{ type: "data", key: "Power", values: [100, 120], isDifferent: true }],
      },
    ];

    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          diffRefIndex: 0,
          canToggleDiffMode: false,
          columnIndex: 1,
          diffMode: "vs-original",
        })}
      />,
    );

    // diff = 120 - 100 = +20
    const editCol = screen.getByTestId("edit-cell-Engine-Power");
    expect(editCol.textContent).toContain("20");
  });
});
