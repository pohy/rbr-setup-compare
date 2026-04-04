import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getLabel, getSectionLabel } from "../../lib/label-map.ts";
import { parseLspSetup } from "../../lib/lsp-parser.ts";
import { getUnit, sanitizeSetup } from "../../lib/sanitize.ts";
import { findCarGroup, findSetup, type McpContext, requireRbrDir } from "../context.ts";
import { readMcpSidecar } from "../mcp-managed.ts";

export async function readSetup(
  ctx: McpContext,
  args: { car: string; file: string },
): Promise<CallToolResult> {
  try {
    requireRbrDir(ctx);
    const group = findCarGroup(ctx, args.car);
    const setup = findSetup(group, args.file);

    const file = await setup.fileRef.getFile();
    const text = await file.text();
    const parsed = parseLspSetup(text, setup.relativePath);
    const sanitized = sanitizeSetup(parsed);

    // Enrich with labels and units
    const sections: Record<
      string,
      {
        label: string;
        values: Record<string, { value: number | string; label: string; unit?: string }>;
      }
    > = {};

    for (const [sectionName, section] of Object.entries(sanitized.sections)) {
      const enrichedValues: Record<
        string,
        { value: number | string; label: string; unit?: string }
      > = {};
      for (const [key, value] of Object.entries(section.values)) {
        enrichedValues[key] = {
          value,
          label: getLabel(key),
          unit: getUnit(key),
        };
      }
      sections[sectionName] = {
        label: getSectionLabel(sectionName),
        values: enrichedValues,
      };
    }

    const rbrDir = ctx.rbrDir as string;
    const sidecar = await readMcpSidecar(join(rbrDir, setup.relativePath));

    const result = {
      name: sanitized.name,
      car: group.carInfo,
      sections,
      mcpManaged: sidecar,
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }
}
