import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod/v4";
import { parseLspSetup } from "../../lib/lsp-parser.ts";
import { mapRangesToSetup } from "../../lib/range-mapping.ts";
import { parseRangeFile } from "../../lib/range-parser.ts";
import {
  findCarGroup,
  findRangeFile,
  findSetup,
  type McpContext,
  requireRbrDir,
} from "../context.ts";
import type { ChangeEntry } from "../schemas.ts";
import { validateAndPreviewChanges } from "./validate-changes.ts";

export async function proposeChange(
  ctx: McpContext,
  args: {
    car: string;
    file: string;
    surface: string;
    changes: z.infer<typeof ChangeEntry>[];
  },
): Promise<CallToolResult> {
  try {
    requireRbrDir(ctx);
    const group = findCarGroup(ctx, args.car);
    const setup = findSetup(group, args.file);
    const rangeEntry = findRangeFile(group, args.surface);

    // Parse setup
    const setupFile = await setup.fileRef.getFile();
    const setupText = await setupFile.text();
    const rawSetup = parseLspSetup(setupText, setup.relativePath);

    // Parse ranges
    const rangeFile = await rangeEntry.fileRef.getFile();
    const rangeText = await rangeFile.text();
    const rawRanges = parseRangeFile(rangeText);
    const rangeMap = mapRangesToSetup(rawRanges);

    const previews = validateAndPreviewChanges(rawSetup, rangeMap, args.changes);
    return { content: [{ type: "text", text: JSON.stringify(previews, null, 2) }] };
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }
}
