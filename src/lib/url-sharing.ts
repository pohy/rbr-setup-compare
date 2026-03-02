import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { SCHEMA_KEYS, SETUP_SCHEMA } from "../generated/setup-schema.ts";
import type { CarSetup } from "./lsp-parser.ts";

const SCHEMA_VERSION = 1;
const MAX_COMPRESSED_LENGTH = 50_000;

/**
 * Serialized comparison state encoded into the URL hash.
 * Values in `s` follow SETUP_SCHEMA order — only values are stored, keys are implicit.
 */
type Payload = {
  /** Schema version — must match SCHEMA_VERSION to decode */
  v: number;
  /** diffsOnly toggle state */
  d: boolean;
  /** Setup names (filenames or paths) */
  n: string[];
  /** Per-setup value arrays in SETUP_SCHEMA order */
  s: (number | string | null)[][];
};

type BuildResult = { ok: true; url: string; droppedKeys: number } | { ok: false; error: string };

export function buildShareUrl(setups: CarSetup[], diffsOnly: boolean): BuildResult {
  let droppedKeys = 0;

  const names = setups.map((s) => s.name);
  const values: (number | string | null)[][] = [];

  for (const setup of setups) {
    const row: (number | string | null)[] = [];

    // Walk schema to extract values in order
    for (const [section, key] of SETUP_SCHEMA) {
      const val = setup.sections[section]?.values[key] ?? null;
      row.push(val);
    }

    // Count keys present in setup but absent from schema
    for (const [sectionName, section] of Object.entries(setup.sections)) {
      for (const key of Object.keys(section.values)) {
        if (!SCHEMA_KEYS.has(`${sectionName}.${key}`)) {
          droppedKeys++;
        }
      }
    }

    values.push(row);
  }

  const payload: Payload = { v: SCHEMA_VERSION, d: diffsOnly, n: names, s: values };
  const compressed = compressToEncodedURIComponent(JSON.stringify(payload));

  if (compressed.length > MAX_COMPRESSED_LENGTH) {
    return { ok: false, error: "Compressed data too large for URL" };
  }

  const url = `${window.location.origin}${window.location.pathname}#data=${compressed}`;
  return { ok: true, url, droppedKeys };
}

type HydrateResult = { found: true; setups: CarSetup[]; diffsOnly: boolean } | { found: false };

export function hydrateFromUrl(): HydrateResult {
  const hash = window.location.hash;
  if (!hash.startsWith("#data=")) return { found: false };

  try {
    const compressed = hash.slice("#data=".length);
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return { found: false };

    const payload = JSON.parse(json) as Payload;
    if (payload.v !== SCHEMA_VERSION || !Array.isArray(payload.s)) {
      return { found: false };
    }

    const setups: CarSetup[] = payload.n.map((name, setupIndex) => {
      const valueArray = payload.s[setupIndex] ?? [];
      const sections: CarSetup["sections"] = {};

      for (let i = 0; i < SETUP_SCHEMA.length; i++) {
        const [sectionName, key] = SETUP_SCHEMA[i];
        const val = valueArray[i] ?? null;
        if (val === null) continue;

        if (!sections[sectionName]) {
          sections[sectionName] = { id: "", values: {} };
        }
        sections[sectionName].values[key] = val;
      }

      return { name, sections };
    });

    return { found: true, setups, diffsOnly: payload.d };
  } catch (e) {
    console.error("[url-sharing] Failed to hydrate from URL:", e);
    return { found: false };
  }
}

export function clearUrlHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}
