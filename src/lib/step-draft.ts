import type { RangeTriplet } from "./range-parser.ts";
import { stepValue } from "./use-setup-editor.ts";

/**
 * Compute the next value string for arrow-key stepping in draft mode.
 * Returns null if the current text is not a valid number.
 */
export function stepDraft(
  current: string,
  direction: 1 | -1,
  fine: boolean,
  range?: RangeTriplet,
  fallbackStep?: number,
): string | null {
  const num = parseFloat(current);
  if (Number.isNaN(num)) {
    return null;
  }

  if (range) {
    const result = stepValue(num, direction, range, fine);
    // Round to step precision to avoid float drift in string output
    const effectiveStep = fine ? range.step / 10 : range.step;
    const stepStr = String(effectiveStep);
    const stepDecimals = stepStr.includes(".") ? stepStr.split(".")[1].length : 0;
    const f = 10 ** stepDecimals;
    return String(Math.round(result * f) / f);
  }

  // Fallback: derive step from decimal precision
  const decimals = current.includes(".") ? current.split(".")[1].length : 0;
  const step = fallbackStep ?? 10 ** -decimals;
  const delta = fine ? step / 10 : step;
  const raw = num + direction * delta;
  const precision = decimals + (fine ? 1 : 0);
  const factor = 10 ** precision;
  return String(Math.round(raw * factor) / factor);
}
