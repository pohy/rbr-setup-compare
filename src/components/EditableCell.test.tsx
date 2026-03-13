// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});
