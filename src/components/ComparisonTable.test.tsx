// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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
    onRenameAndSave: noop,
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

describe("ComparisonTable non-numeric cell stepping", () => {
  it("does not enable step controls for non-numeric values", () => {
    const result: ComparisonResult = [
      {
        sectionName: "Engine",
        rows: [
          {
            type: "data",
            key: "Camber",
            values: ["0.526 -2.416 0.71", "0.526 -2.416 0.71"],
            isDifferent: false,
          },
        ],
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
        editConfig={makeEditConfig({ columnIndex: 1, diffRefIndex: 0 })}
      />,
    );

    const editCell = screen.getByTestId("edit-cell-Engine-Camber");
    const cell = editCell.querySelector("[role=button]") as HTMLElement;
    // Non-numeric cells should use cursor-text (no step zones), not cursor-ew-resize
    expect(cell.className).toContain("cursor-text");
    expect(cell.className).not.toContain("cursor-ew-resize");
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

describe("ComparisonTable editDisabledReason", () => {
  const result: ComparisonResult = [
    {
      sectionName: "Engine",
      rows: [{ type: "data", key: "Power", values: [100], isDifferent: false }],
    },
  ];

  it("shows disabled Edit button with title when editDisabledReason is set", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editDisabledReason="Save setup to edit it"
      />,
    );

    // Open the popover for setup1
    const header = screen.getAllByRole("columnheader")[0];
    const menuButton = header.querySelector("button") as HTMLElement;
    fireEvent.click(menuButton);

    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton).toBeDisabled();
    expect(editButton.title).toBe("Save setup to edit it");
  });

  it("hides Edit button when neither onStartEdit nor editDisabledReason is set", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
      />,
    );

    const header = screen.getAllByRole("columnheader")[0];
    const menuButton = header.querySelector("button") as HTMLElement;
    fireEvent.click(menuButton);

    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
  });
});

describe("ComparisonTable save to my setups toggle", () => {
  const result: ComparisonResult = [
    {
      sectionName: "Engine",
      rows: [{ type: "data", key: "Power", values: [100, 200], isDifferent: true }],
    },
  ];

  function openPopoverForSetup(index: number) {
    const headers = screen.getAllByRole("columnheader");
    const menuButton = headers[index].querySelector("button") as HTMLElement;
    fireEvent.click(menuButton);
  }

  it("shows 'Save to my setups' when onToggleSaveSetup provided and setup not saved", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        savedSetupIndices={new Set()}
        onToggleSaveSetup={noop}
      />,
    );

    openPopoverForSetup(0);

    expect(screen.getByRole("button", { name: /save to my setups/i })).toBeInTheDocument();
  });

  it("shows 'Remove from my setups' when setup is saved", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        savedSetupIndices={new Set([0])}
        onToggleSaveSetup={noop}
      />,
    );

    openPopoverForSetup(0);

    expect(screen.getByRole("button", { name: /remove from my setups/i })).toBeInTheDocument();
  });

  it("calls onToggleSaveSetup with correct index", () => {
    const onToggle = vi.fn();
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        savedSetupIndices={new Set()}
        onToggleSaveSetup={onToggle}
      />,
    );

    openPopoverForSetup(1);
    fireEvent.click(screen.getByRole("button", { name: /save to my setups/i }));

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("does not show save button when onToggleSaveSetup is not provided", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
      />,
    );

    openPopoverForSetup(0);

    expect(screen.queryByRole("button", { name: /save to my setups/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remove from my setups/i })).toBeNull();
  });
});
