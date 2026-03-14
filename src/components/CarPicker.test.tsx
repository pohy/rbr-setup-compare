// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CarPicker } from "./CarPicker.tsx";

describe("CarPicker", () => {
  afterEach(cleanup);

  it("renders car names as options", () => {
    render(<CarPicker carNames={["Car A", "Car B"]} selectedCar={null} onSelect={() => {}} />);
    expect(screen.getByRole("option", { name: "Car A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Car B" })).toBeInTheDocument();
  });

  it("calls onSelect when a car is selected", () => {
    const onSelect = vi.fn();
    render(<CarPicker carNames={["Car A", "Car B"]} selectedCar={null} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Car A" } });
    expect(onSelect).toHaveBeenCalledWith("Car A");
  });

  it("does not call onSelect for empty value", () => {
    const onSelect = vi.fn();
    render(<CarPicker carNames={["Car A"]} selectedCar={null} onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows placeholder option", () => {
    render(<CarPicker carNames={["Car A"]} selectedCar={null} onSelect={() => {}} />);
    expect(screen.getByRole("option", { name: /pick car/i })).toBeInTheDocument();
  });
});
