import { tokenize } from "./lsp-parser.ts";

export type RangeTriplet = { min: number; max: number; step: number };
export type RawRangeData = Map<string, Map<string, RangeTriplet>>;

type SuffixPattern = {
  max: string;
  min: string;
  step: string;
  /** Suffix to append to the base name (e.g. "_NGP") */
  baseSuffix: string;
};

const SUFFIX_PATTERNS: SuffixPattern[] = [
  { max: "RangeMax", min: "RangeMin", step: "RangeStep", baseSuffix: "" },
  { max: "Max_NGP", min: "Min_NGP", step: "Step_NGP", baseSuffix: "_NGP" },
  { max: "Max", min: "Min", step: "Step", baseSuffix: "" },
];

function classifyKey(key: string): { base: string; role: "max" | "min" | "step" } | null {
  for (const pattern of SUFFIX_PATTERNS) {
    if (key.endsWith(pattern.max)) {
      return {
        base: key.slice(0, -pattern.max.length) + pattern.baseSuffix,
        role: "max",
      };
    }
    if (key.endsWith(pattern.min)) {
      return {
        base: key.slice(0, -pattern.min.length) + pattern.baseSuffix,
        role: "min",
      };
    }
    if (key.endsWith(pattern.step)) {
      return {
        base: key.slice(0, -pattern.step.length) + pattern.baseSuffix,
        role: "step",
      };
    }
  }
  return null;
}

export function parseRangeFile(text: string): RawRangeData {
  const tokens = tokenize(text);
  const result: RawRangeData = new Map();
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }
  function next(): string {
    return tokens[pos++];
  }
  function expect(val: string) {
    const t = next();
    if (t !== val) {
      throw new Error(`Expected "${val}", got "${t}" at token ${pos - 1}`);
    }
  }
  function isNumeric(s: string): boolean {
    return /^[+-]?\d+(\.\d+)?$/.test(s);
  }
  function unquote(s: string): string {
    return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
  }

  // Top level: (( "(null)" SectionName (...) SectionName (...) ... ))
  expect("(");
  expect("(");
  next(); // root id "(null)"

  // Parse sections
  while (peek() && peek() !== ")") {
    const sectionName = next();
    if (sectionName === ")") {
      break;
    }

    expect("(");
    unquote(next()); // skip section id "(null)"

    // Collect key-value pairs
    const kvs = new Map<string, number>();
    while (peek() !== ")" && pos < tokens.length) {
      const key = next();
      if (key === ")") {
        pos--; // put back
        break;
      }

      // Consume numeric values following the key
      const nums: number[] = [];
      while (peek() !== undefined && peek() !== ")" && isNumeric(peek() as string)) {
        nums.push(parseFloat(next()));
      }

      // Only single-value numeric keys are candidates for triplets
      if (nums.length === 1) {
        kvs.set(key, nums[0]);
      }
    }
    expect(")"); // close section body

    // Group into triplets
    const partials = new Map<string, Partial<RangeTriplet>>();
    for (const [key, value] of kvs) {
      const classified = classifyKey(key);
      if (!classified) {
        continue;
      }
      const existing = partials.get(classified.base) ?? {};
      existing[classified.role] = value;
      partials.set(classified.base, existing);
    }

    // Only keep complete triplets
    const triplets = new Map<string, RangeTriplet>();
    for (const [base, partial] of partials) {
      if (partial.min !== undefined && partial.max !== undefined && partial.step !== undefined) {
        triplets.set(base, { min: partial.min, max: partial.max, step: partial.step });
      }
    }

    if (triplets.size > 0) {
      result.set(sectionName, triplets);
    }
  }

  return result;
}
