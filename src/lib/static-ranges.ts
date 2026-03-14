import { mapRangesToSetup, type RangeMap } from "./range-mapping.ts";
import type { RangeTriplet, RawRangeData } from "./range-parser.ts";

export type StaticRangesData = Record<
  string,
  Record<string, Record<string, [number, number, number]>>
>;

export function deserializeRawRanges(
  data: Record<string, Record<string, [number, number, number]>>,
): RawRangeData {
  const result: RawRangeData = new Map();
  for (const [section, keys] of Object.entries(data)) {
    const sectionMap = new Map<string, RangeTriplet>();
    for (const [key, [min, max, step]] of Object.entries(keys)) {
      sectionMap.set(key, { min, max, step });
    }
    result.set(section, sectionMap);
  }
  return result;
}

export function resolveStaticRanges(
  staticData: StaticRangesData,
  carName: string,
): RangeMap | null {
  const carData = staticData[carName];
  if (!carData) return null;
  const raw = deserializeRawRanges(carData);
  return mapRangesToSetup(raw);
}

export function getCarNames(staticData: StaticRangesData): string[] {
  return Object.keys(staticData).sort();
}
