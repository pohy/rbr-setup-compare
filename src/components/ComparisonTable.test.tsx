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
    sourceIndex: -1,
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

describe("ComparisonTable diff mode toggle title shows target setup name", () => {
  const result: ComparisonResult = [
    {
      sectionName: "Engine",
      rows: [{ type: "data", key: "RPM", values: [5000, 5000, 5000], isDifferent: false }],
    },
  ];

  it("shows original setup name in title when diffMode is vs-reference", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1.lsp", "setup2.lsp", "edited.lsp"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          canToggleDiffMode: true,
          sourceIndex: 1,
          diffRefIndex: 0,
          columnIndex: 2,
          diffMode: "vs-reference",
        })}
      />,
    );

    openEditPopover();

    const toggleButton = screen.getByRole("button", { name: /compare vs original/i });
    expect(toggleButton.getAttribute("title")).toBe("Compare vs setup2.lsp");
  });

  it("shows reference setup name in title when diffMode is vs-original", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1.lsp", "setup2.lsp", "edited.lsp"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({
          canToggleDiffMode: true,
          sourceIndex: 1,
          diffRefIndex: 1,
          columnIndex: 2,
          diffMode: "vs-original",
        })}
      />,
    );

    openEditPopover();

    const toggleButton = screen.getByRole("button", { name: /compare vs reference/i });
    expect(toggleButton.getAttribute("title")).toBe("Compare vs setup1.lsp");
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

describe("ComparisonTable LSP labels toggle", () => {
  const result: ComparisonResult = [
    {
      sectionName: "SpringDamperFront",
      rows: [{ type: "data", key: "DampingBump", values: [100, 200], isDifferent: true }],
    },
  ];

  it("shows in-game labels by default (showLspLabels=false)", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        showLspLabels={false}
      />,
    );

    expect(screen.getByText("Bump")).toBeInTheDocument();
    expect(screen.getByText("Springs & Dampers (Front)")).toBeInTheDocument();
  });

  it("shows LSP keys when showLspLabels=true", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        showLspLabels={true}
      />,
    );

    expect(screen.getByText("DampingBump")).toBeInTheDocument();
    expect(screen.getByText("SpringDamperFront")).toBeInTheDocument();
  });
});

describe("ComparisonTable save by overwriting button state", () => {
  const result: ComparisonResult = [
    {
      sectionName: "Engine",
      rows: [{ type: "data", key: "Power", values: [100, 200], isDifferent: true }],
    },
  ];

  const sharedProps = {
    result,
    setupNames: ["setup1", "edited"],
    onRemoveSetup: noop,
    onSaveSetup: noop,
    onReorderSetup: noop,
    diffsOnly: false,
  } as const;

  it("enables 'Save by overwriting...' when there are pending edits", () => {
    const edits = new Map([["Engine", new Map([["Power", 999]])]]);
    render(
      <ComparisonTable
        {...sharedProps}
        editConfig={makeEditConfig({ columnIndex: 1, canOverwrite: true, edits })}
      />,
    );

    openEditPopover();

    const overwriteButton = screen.getByRole("button", { name: /save by overwriting/i });
    expect(overwriteButton).not.toBeDisabled();
  });

  it("disables 'Save by overwriting...' but keeps it visible when there are no edits", () => {
    render(
      <ComparisonTable
        {...sharedProps}
        editConfig={makeEditConfig({ columnIndex: 1, canOverwrite: true, edits: new Map() })}
      />,
    );

    openEditPopover();

    const overwriteButton = screen.getByRole("button", { name: /save by overwriting/i });
    expect(overwriteButton).toBeDisabled();
    expect(overwriteButton).toHaveAttribute("title");
    expect(overwriteButton.getAttribute("title")).toBeTruthy();
  });
});

describe("ComparisonTable remove button label", () => {
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

  it('shows "Remove" when editor is not open', () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
      />,
    );

    openPopoverForSetup(0);

    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it('shows "Remove" for a column that is not being edited', () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({ columnIndex: 1 })}
      />,
    );

    openPopoverForSetup(0);

    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it('shows "Remove and close editor" on source column with no pending edits', () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({ columnIndex: 2, sourceIndex: 0, edits: new Map() })}
      />,
    );

    openPopoverForSetup(0);

    expect(screen.getByRole("button", { name: "Remove and close editor" })).toBeInTheDocument();
  });

  it('shows "Remove and discard edits..." on source column with pending edits', () => {
    const edits = new Map([["Engine", new Map([["Power", 999]])]]);
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        editConfig={makeEditConfig({ columnIndex: 2, sourceIndex: 0, edits })}
      />,
    );

    openPopoverForSetup(0);

    expect(screen.getByRole("button", { name: "Remove and discard edits..." })).toBeInTheDocument();
  });
});

describe("ComparisonTable readonly row visibility", () => {
  const result: ComparisonResult = [
    {
      sectionName: "Drive",
      rows: [
        {
          type: "data",
          key: "GearId2",
          values: [3, 3],
          isDifferent: false,
          isReadonly: true,
        },
        {
          type: "data",
          key: "GearId3",
          values: [4, 5],
          isDifferent: true,
          isReadonly: true,
        },
        {
          type: "data",
          key: "DropGearId",
          values: [10, 10],
          isDifferent: false,
          isReadonly: false,
        },
      ],
    },
  ];

  it("hides readonly rows that are not different when enableReadonly is off", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        enableReadonly={false}
        showLspLabels={true}
      />,
    );

    expect(screen.queryByText("GearId2")).not.toBeInTheDocument();
    expect(screen.getByText("GearId3")).toBeInTheDocument();
    expect(screen.getByText("DropGearId")).toBeInTheDocument();
  });

  it("shows all readonly rows when enableReadonly is on", () => {
    render(
      <ComparisonTable
        result={result}
        setupNames={["setup1", "setup2"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        enableReadonly={true}
        showLspLabels={true}
      />,
    );

    expect(screen.getByText("GearId2")).toBeInTheDocument();
    expect(screen.getByText("GearId3")).toBeInTheDocument();
    expect(screen.getByText("DropGearId")).toBeInTheDocument();
  });

  it("hides section when all rows are readonly and hidden", () => {
    const allReadonly: ComparisonResult = [
      {
        sectionName: "Drive",
        rows: [
          {
            type: "data",
            key: "GearId2",
            values: [3, 3],
            isDifferent: false,
            isReadonly: true,
          },
        ],
      },
    ];

    render(
      <ComparisonTable
        result={allReadonly}
        setupNames={["setup1", "setup2"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        enableReadonly={false}
        showLspLabels={true}
      />,
    );

    expect(screen.queryByText("Drive")).not.toBeInTheDocument();
    expect(screen.queryByText("GearId2")).not.toBeInTheDocument();
  });

  it("renders readonly edit-column cell as plain text when enableReadonly is off", () => {
    const withEdit: ComparisonResult = [
      {
        sectionName: "Drive",
        rows: [
          {
            type: "data",
            key: "GearId3",
            values: [4, 5, 5],
            isDifferent: true,
            isReadonly: true,
          },
        ],
      },
    ];

    render(
      <ComparisonTable
        result={withEdit}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        enableReadonly={false}
        showLspLabels={true}
        editConfig={makeEditConfig({ columnIndex: 2, diffRefIndex: 0 })}
      />,
    );

    // Readonly row visible (because isDifferent) but edit column renders
    // as plain cell (no editable cell testid).
    expect(screen.getByText("GearId3")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-cell-Drive-GearId3")).not.toBeInTheDocument();
  });

  it("renders readonly edit-column cell as editable when enableReadonly is on", () => {
    const withEdit: ComparisonResult = [
      {
        sectionName: "Drive",
        rows: [
          {
            type: "data",
            key: "GearId3",
            values: [4, 5, 5],
            isDifferent: true,
            isReadonly: true,
          },
        ],
      },
    ];

    render(
      <ComparisonTable
        result={withEdit}
        setupNames={["setup1", "setup2", "edited"]}
        onRemoveSetup={noop}
        onSaveSetup={noop}
        onReorderSetup={noop}
        diffsOnly={false}
        enableReadonly={true}
        showLspLabels={true}
        editConfig={makeEditConfig({ columnIndex: 2, diffRefIndex: 0 })}
      />,
    );

    expect(screen.getByTestId("edit-cell-Drive-GearId3")).toBeInTheDocument();
  });
});
