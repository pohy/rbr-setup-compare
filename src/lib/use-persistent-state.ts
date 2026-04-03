import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { EditState } from "./use-setup-editor.ts";

type StorageMap = {
  "rbr-loaded-paths": string[];
  "rbr-setup-filter": string;
  "rbr-edit-state": EditState | null;
};

type StorageKey = keyof StorageMap;

type PersistOptions<K extends StorageKey> = {
  serialize?: (value: StorageMap[K]) => unknown;
  deserialize?: (raw: unknown) => StorageMap[K];
};

// Module-level state — not exported (except the test reset helper)
const cache = new Map<string, { json: string; value: unknown }>();
const subscribers = new Map<string, Set<() => void>>();
let storageListenerAttached = false;

export function usePersistentState<K extends StorageKey>(
  key: K,
  defaultValue: StorageMap[K],
  options?: PersistOptions<K>,
): [StorageMap[K], (value: StorageMap[K] | ((prev: StorageMap[K]) => StorageMap[K])) => void] {
  // Stabilize options to avoid re-renders when caller creates inline objects
  const serialize = options?.serialize;
  const deserialize = options?.deserialize;
  const stableOptions = useMemo(
    () => (serialize || deserialize ? { serialize, deserialize } : undefined),
    [serialize, deserialize],
  );

  const value = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => getSnapshot(key, defaultValue, stableOptions),
  );

  const set = useCallback(
    (v: StorageMap[K] | ((prev: StorageMap[K]) => StorageMap[K])) => {
      setValue(key, v, defaultValue, stableOptions);
    },
    [key, defaultValue, stableOptions],
  );

  return [value, set];
}

/** Test-only: resets all module-level state. */
export function __resetPersistentStateForTesting() {
  cache.clear();
  subscribers.clear();
  if (storageListenerAttached) {
    window.removeEventListener("storage", handleStorageEvent);
    storageListenerAttached = false;
  }
}
function notifySubscribers(key: string) {
  const subs = subscribers.get(key);
  if (subs) {
    for (const cb of subs) {
      cb();
    }
  }
}

function handleStorageEvent(e: StorageEvent) {
  if (e.storageArea !== localStorage) {
    return;
  }
  if (e.key === null) {
    // Storage was cleared
    cache.clear();
    for (const key of subscribers.keys()) {
      notifySubscribers(key);
    }
    return;
  }
  if (!subscribers.has(e.key)) {
    return;
  }
  // Invalidate cache — let getSnapshot re-read with the correct deserializer
  cache.delete(e.key);
  notifySubscribers(e.key);
}

function subscribe(key: string, listener: () => void): () => void {
  let subs = subscribers.get(key);
  if (!subs) {
    subs = new Set();
    subscribers.set(key, subs);
  }
  subs.add(listener);

  if (!storageListenerAttached) {
    window.addEventListener("storage", handleStorageEvent);
    storageListenerAttached = true;
  }

  return () => {
    subs.delete(listener);
    if (subs.size === 0) {
      subscribers.delete(key);
    }
  };
}

function getSnapshot<K extends StorageKey>(
  key: K,
  defaultValue: StorageMap[K],
  options?: PersistOptions<K>,
): StorageMap[K] {
  const cached = cache.get(key);
  if (cached) {
    return cached.value as StorageMap[K];
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return defaultValue;
    }
    const jsonParsed = JSON.parse(raw);
    const value = options?.deserialize
      ? options.deserialize(jsonParsed)
      : (jsonParsed as StorageMap[K]);
    cache.set(key, { json: raw, value });
    return value;
  } catch {
    return defaultValue;
  }
}

function setValue<K extends StorageKey>(
  key: K,
  valueOrFn: StorageMap[K] | ((prev: StorageMap[K]) => StorageMap[K]),
  defaultValue: StorageMap[K],
  options?: PersistOptions<K>,
) {
  const prev = getSnapshot(key, defaultValue, options);
  const next =
    typeof valueOrFn === "function"
      ? (valueOrFn as (prev: StorageMap[K]) => StorageMap[K])(prev)
      : valueOrFn;

  const toSerialize = options?.serialize ? options.serialize(next) : next;
  const json = JSON.stringify(toSerialize);
  cache.set(key, { json, value: next });

  try {
    localStorage.setItem(key, json);
  } catch {
    // Quota exceeded — value still works in-memory for this session
  }

  notifySubscribers(key);
}
