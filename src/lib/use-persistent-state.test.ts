// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetPersistentStateForTesting, usePersistentState } from "./use-persistent-state.ts";

beforeEach(() => {
  localStorage.clear();
  __resetPersistentStateForTesting();
});

afterEach(() => {
  localStorage.clear();
  __resetPersistentStateForTesting();
});

describe("usePersistentState", () => {
  it("returns defaultValue when localStorage is empty", () => {
    const { result } = renderHook(() => usePersistentState("rbr-setup-filter", ""));
    expect(result.current[0]).toBe("");
  });

  it("returns stored value when localStorage has data", () => {
    localStorage.setItem("rbr-loaded-paths", JSON.stringify(["a.lsp", "b.lsp"]));
    const { result } = renderHook(() => usePersistentState("rbr-loaded-paths", []));
    expect(result.current[0]).toEqual(["a.lsp", "b.lsp"]);
  });

  it("setValue updates value and persists to localStorage", () => {
    const { result } = renderHook(() => usePersistentState("rbr-setup-filter", ""));
    act(() => {
      result.current[1]("hello");
    });
    expect(result.current[0]).toBe("hello");
    expect(localStorage.getItem("rbr-setup-filter")).toBe(JSON.stringify("hello"));
  });

  it("functional updater works", () => {
    const { result } = renderHook(() => usePersistentState("rbr-loaded-paths", []));
    act(() => {
      result.current[1](["a.lsp"]);
    });
    act(() => {
      result.current[1]((prev) => [...prev, "b.lsp"]);
    });
    expect(result.current[0]).toEqual(["a.lsp", "b.lsp"]);
  });

  it("cross-component sync: two hooks with same key stay in sync", () => {
    const { result: r1 } = renderHook(() => usePersistentState("rbr-setup-filter", ""));
    const { result: r2 } = renderHook(() => usePersistentState("rbr-setup-filter", ""));

    act(() => {
      r1.current[1]("synced");
    });

    expect(r1.current[0]).toBe("synced");
    expect(r2.current[0]).toBe("synced");
  });

  it("handles corrupted JSON in localStorage gracefully", () => {
    localStorage.setItem("rbr-loaded-paths", "not-json{{{");
    const { result } = renderHook(() => usePersistentState("rbr-loaded-paths", []));
    expect(result.current[0]).toEqual([]);
  });

  it("cross-tab sync via StorageEvent", () => {
    const { result } = renderHook(() => usePersistentState("rbr-setup-filter", ""));

    // Simulate another tab writing to localStorage
    act(() => {
      localStorage.setItem("rbr-setup-filter", JSON.stringify("from-tab-2"));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "rbr-setup-filter",
          newValue: JSON.stringify("from-tab-2"),
          storageArea: localStorage,
        }),
      );
    });

    expect(result.current[0]).toBe("from-tab-2");
  });

  it("cleanup: unmount removes subscriber", () => {
    const { result, unmount } = renderHook(() => usePersistentState("rbr-setup-filter", ""));
    act(() => {
      result.current[1]("before-unmount");
    });
    expect(result.current[0]).toBe("before-unmount");
    unmount();

    // After unmount, writing to same key shouldn't throw
    const { result: r2 } = renderHook(() => usePersistentState("rbr-setup-filter", ""));
    act(() => {
      r2.current[1]("after-unmount");
    });
    expect(r2.current[0]).toBe("after-unmount");
  });

  it("works with string values", () => {
    const { result } = renderHook(() => usePersistentState("rbr-setup-filter", "default"));
    act(() => {
      result.current[1]("updated");
    });
    expect(result.current[0]).toBe("updated");
  });

  it("works with array values", () => {
    const { result } = renderHook(() => usePersistentState("rbr-loaded-paths", []));
    act(() => {
      result.current[1](["x", "y", "z"]);
    });
    expect(result.current[0]).toEqual(["x", "y", "z"]);
  });

  it("custom serialize/deserialize round-trips correctly", () => {
    // Use a Map-like structure: serialize to array of entries, deserialize back
    type MapState = Map<string, number>;
    const opts = {
      serialize: (v: MapState | null) => (v ? Object.fromEntries(v) : null),
      deserialize: (raw: unknown) =>
        raw && typeof raw === "object"
          ? new Map(Object.entries(raw as Record<string, number>))
          : null,
    };

    const { result } = renderHook(() =>
      usePersistentState("rbr-edit-state", null as MapState | null, opts),
    );

    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    act(() => {
      result.current[1](map);
    });
    const value = result.current[0];
    expect(value).toBeInstanceOf(Map);
    expect([...(value as Map<string, number>).entries()]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    // Check what's actually in localStorage (serialized form)
    const stored = localStorage.getItem("rbr-edit-state");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({ a: 1, b: 2 });
  });

  it("deserialize failure returns defaultValue", () => {
    const opts = {
      serialize: (v: string | null) => v,
      deserialize: (_raw: unknown): string | null => {
        throw new Error("bad data");
      },
    };

    localStorage.setItem("rbr-edit-state", JSON.stringify("corrupt"));
    const { result } = renderHook(() =>
      usePersistentState("rbr-edit-state", null as string | null, opts),
    );
    expect(result.current[0]).toBeNull();
  });
});
