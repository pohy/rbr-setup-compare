import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getLabel, getSectionLabel } from "../../lib/label-map.ts";
import { mapRangesToSetup } from "../../lib/range-mapping.ts";
import { parseRangeFile } from "../../lib/range-parser.ts";
import { getModifier, getUnit } from "../../lib/sanitize.ts";
import { findCarGroup, findRangeFile, type McpContext, requireRbrDir } from "../context.ts";

export async function readRanges(
  ctx: McpContext,
  args: { car: string; surface: string },
): Promise<CallToolResult> {
  try {
    requireRbrDir(ctx);
    const group = findCarGroup(ctx, args.car);
    const entry = findRangeFile(group, args.surface);

    const file = await entry.fileRef.getFile();
    const text = await file.text();
    const raw = parseRangeFile(text);
    const rangeMap = mapRangesToSetup(raw);

    // Convert to JSON-serializable format with display-unit modifiers applied
    const result: Record<
      string,
      {
        label: string;
        fields: Record<
          string,
          { min: number; max: number; step: number; label: string; unit?: string }
        >;
      }
    > = {};

    for (const [section, fields] of rangeMap) {
      const sectionFields: Record<
        string,
        { min: number; max: number; step: number; label: string; unit?: string }
      > = {};

      for (const [key, triplet] of fields) {
        const modifier = getModifier(key);
        sectionFields[key] = {
          min: triplet.min * modifier,
          max: triplet.max * modifier,
          step: triplet.step * modifier,
          label: getLabel(key),
          unit: getUnit(key),
        };
      }

      result[section] = {
        label: getSectionLabel(section),
        fields: sectionFields,
      };
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }
}
