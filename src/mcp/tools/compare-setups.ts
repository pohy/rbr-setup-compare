import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { compareSetups as compareSetupsLib } from "../../lib/compare.ts";
import { getLabel, getSectionLabel } from "../../lib/label-map.ts";
import { parseLspSetup } from "../../lib/lsp-parser.ts";
import { findCarGroup, findSetup, type McpContext, requireRbrDir } from "../context.ts";

export async function compareSetups(
  ctx: McpContext,
  args: { car: string; files: string[] },
): Promise<CallToolResult> {
  try {
    requireRbrDir(ctx);
    const group = findCarGroup(ctx, args.car);

    const setups = await Promise.all(
      args.files.map(async (fileName) => {
        const setup = findSetup(group, fileName);
        const file = await setup.fileRef.getFile();
        const text = await file.text();
        return parseLspSetup(text, setup.relativePath);
      }),
    );

    const comparison = compareSetupsLib(setups);

    // Enrich with labels
    const result = comparison.map((section) => ({
      sectionName: section.sectionName,
      sectionLabel: getSectionLabel(section.sectionName),
      rows: section.rows.map((row) => {
        if (row.type === "split") {
          return row;
        }
        return {
          ...row,
          label: getLabel(row.key),
        };
      }),
    }));

    const response = {
      car: group.carInfo,
      sections: result,
    };

    return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }
}
