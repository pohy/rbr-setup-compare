// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CarGroup } from "./rbr-scanner.ts";
import { useDirectoryWatcher } from "./use-directory-watcher.ts";

// --- Mock FileSystemObserver ---

let observerCallback: FileSystemObserverCallback | null = null;
let observerInstance: {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} | null = null;

class MockFileSystemObserver {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;

  constructor(callback: FileSystemObserverCallback) {
    observerCallback = callback;
    this.observe = vi.fn().mockResolvedValue(undefined);
    this.disconnect = vi.fn();
    observerInstance = this;
  }
}

// --- Mock scanRbrDirectory ---

const mockScanResult: CarGroup[] = [
  { carName: "TestCar", carDir: "TestCar_ngp6", setups: [], rangeFiles: [] },
];

vi.mock("./rbr-scanner.ts", () => ({
  scanRbrDirectory: vi.fn().mockImplementation(() => Promise.resolve(mockScanResult)),
}));

function makeHandle(): FileSystemDirectoryHandle {
  return { kind: "directory", name: "test" } as unknown as FileSystemDirectoryHandle;
}

function makeLspRecord(
  type: FileSystemChangeRecord["type"],
  pathParts: string[],
): FileSystemChangeRecord {
  return {
    type,
    relativePathComponents: pathParts,
    changedHandle: null,
    root: makeHandle(),
  };
}

function fireCallback(records: FileSystemChangeRecord[]) {
  if (!observerCallback) {
    throw new Error("observer not initialized");
  }
  observerCallback(records, {} as FileSystemObserver);
}

function getObserver() {
  if (!observerInstance) {
    throw new Error("observer not initialized");
  }
  return observerInstance;
}

describe("useDirectoryWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observerCallback = null;
    observerInstance = null;
    (globalThis as Record<string, unknown>).FileSystemObserver = MockFileSystemObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).FileSystemObserver;
  });

  it("does not observe when enabled is false", () => {
    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: makeHandle(),
        enabled: false,
        onChanges: vi.fn(),
      }),
    );
    expect(observerInstance).toBeNull();
  });

  it("does not observe when handle is null", () => {
    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: null,
        enabled: true,
        onChanges: vi.fn(),
      }),
    );
    expect(observerInstance).toBeNull();
  });

  it("creates observer and calls observe with { recursive: true } when enabled", () => {
    const handle = makeHandle();
    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: handle,
        enabled: true,
        onChanges: vi.fn(),
      }),
    );
    expect(observerInstance).not.toBeNull();
    expect(getObserver().observe).toHaveBeenCalledWith(handle, { recursive: true });
  });

  it("debounces rapid change events into a single rescan", async () => {
    const onChanges = vi.fn();
    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: makeHandle(),
        enabled: true,
        debounceMs: 100,
        onChanges,
      }),
    );

    // Fire 3 rapid change events
    act(() => fireCallback([makeLspRecord("appeared", ["setups", "a.lsp"])]));
    act(() => fireCallback([makeLspRecord("appeared", ["setups", "b.lsp"])]));
    act(() => fireCallback([makeLspRecord("appeared", ["setups", "c.lsp"])]));

    // Before debounce fires, no callback yet
    expect(onChanges).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(100);
      // Let the async rescan resolve
      await vi.runAllTimersAsync();
    });

    // Should be called once (debounced)
    expect(onChanges).toHaveBeenCalledTimes(1);
  });

  it("calls onChanges with processed changes and new carGroups after rescan", async () => {
    const onChanges = vi.fn();
    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: makeHandle(),
        enabled: true,
        debounceMs: 50,
        onChanges,
      }),
    );

    act(() => fireCallback([makeLspRecord("modified", ["cars", "BMW", "setups", "fast.lsp"])]));

    await act(async () => {
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
    });

    expect(onChanges).toHaveBeenCalledTimes(1);
    const [changes, groups] = onChanges.mock.calls[0];
    expect(changes).toEqual([{ type: "modified", relativePath: "cars/BMW/setups/fast.lsp" }]);
    expect(groups).toBe(mockScanResult);
  });

  it("does not call onChanges when no .lsp files changed", async () => {
    const onChanges = vi.fn();
    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: makeHandle(),
        enabled: true,
        debounceMs: 50,
        onChanges,
      }),
    );

    act(() => fireCallback([makeLspRecord("modified", ["readme.txt"])]));

    await act(async () => {
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
    });

    expect(onChanges).not.toHaveBeenCalled();
  });

  it("skips rescan if one is already in progress", async () => {
    const { scanRbrDirectory } = await import("./rbr-scanner.ts");
    const scanMock = vi.mocked(scanRbrDirectory);

    // Make first scan take a while by using a deferred promise
    let resolveFirstScan: (value: CarGroup[]) => void = () => {};
    scanMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstScan = resolve;
        }),
    );

    const onChanges = vi.fn();
    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: makeHandle(),
        enabled: true,
        debounceMs: 10,
        onChanges,
      }),
    );

    // Trigger first scan
    act(() => fireCallback([makeLspRecord("appeared", ["setups", "a.lsp"])]));
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    // First scan is in progress, trigger another batch
    act(() => fireCallback([makeLspRecord("appeared", ["setups", "b.lsp"])]));
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    // Resolve first scan
    await act(async () => {
      resolveFirstScan(mockScanResult);
    });

    // Only one onChanges call from the first scan
    expect(onChanges).toHaveBeenCalledTimes(1);
  });

  it("disconnects observer on unmount", () => {
    const { unmount } = renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: makeHandle(),
        enabled: true,
        onChanges: vi.fn(),
      }),
    );
    const instance = getObserver();
    unmount();
    expect(instance.disconnect).toHaveBeenCalled();
  });

  it("disconnects and reconnects when handle changes", () => {
    const handle1 = makeHandle();
    const handle2 = { ...makeHandle(), name: "second" } as unknown as FileSystemDirectoryHandle;

    const { rerender } = renderHook(
      ({ handle }) =>
        useDirectoryWatcher({
          directoryHandle: handle,
          enabled: true,
          onChanges: vi.fn(),
        }),
      { initialProps: { handle: handle1 } },
    );

    const firstInstance = getObserver();
    expect(firstInstance.observe).toHaveBeenCalledWith(handle1, { recursive: true });

    rerender({ handle: handle2 });

    expect(firstInstance.disconnect).toHaveBeenCalled();
    expect(observerInstance).not.toBe(firstInstance);
    expect(getObserver().observe).toHaveBeenCalledWith(handle2, { recursive: true });
  });

  it("disconnects and does not reconnect when enabled goes false", () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useDirectoryWatcher({
          directoryHandle: makeHandle(),
          enabled,
          onChanges: vi.fn(),
        }),
      { initialProps: { enabled: true } },
    );

    const firstInstance = getObserver();
    rerender({ enabled: false });

    expect(firstInstance.disconnect).toHaveBeenCalled();
  });

  it("handles observer errors gracefully", async () => {
    const { scanRbrDirectory } = await import("./rbr-scanner.ts");
    const scanMock = vi.mocked(scanRbrDirectory);
    scanMock.mockRejectedValueOnce(new Error("scan failed"));

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onChanges = vi.fn();

    renderHook(() =>
      useDirectoryWatcher({
        directoryHandle: makeHandle(),
        enabled: true,
        debounceMs: 10,
        onChanges,
      }),
    );

    act(() => fireCallback([makeLspRecord("modified", ["setups", "a.lsp"])]));

    await act(async () => {
      vi.advanceTimersByTime(10);
      await vi.runAllTimersAsync();
    });

    expect(onChanges).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
