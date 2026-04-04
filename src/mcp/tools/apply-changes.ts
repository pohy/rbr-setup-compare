import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod/v4";
import { parseLspSetup } from "../../lib/lsp-parser.ts";
import { setupToLsp } from "../../lib/lsp-writer.ts";
import { mapRangesToSetup } from "../../lib/range-mapping.ts";
import { parseRangeFile } from "../../lib/range-parser.ts";
import { deriveEditedSetup } from "../../lib/setup-edits.ts";
import { savedGamesCarDir } from "../../lib/setup-permissions.ts";
import {
  findCarGroup,
  findRangeFile,
  findSetup,
  type McpContext,
  requireRbrDir,
} from "../context.ts";
import { isMcpManaged, writeMcpSidecar } from "../mcp-managed.ts";
import type { ChangeEntry } from "../schemas.ts";
import { computeRawEdits, validateAndPreviewChanges } from "./validate-changes.ts";

export async function applyChanges(
  ctx: McpContext,
  args: {
    car: string;
    file: string;
    surface: string;
    changes: z.infer<typeof ChangeEntry>[];
    targetFile?: string;
    base?: string;
    meta?: Record<string, unknown>;
  },
): Promise<CallToolResult> {
  try {
    const rbrDir = requireRbrDir(ctx);
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

    // Validate changes (also produces preview for the response)
    const previews = validateAndPreviewChanges(rawSetup, rangeMap, args.changes);

    // Compute raw edits
    const rawEdits = computeRawEdits(rawSetup, rangeMap, args.changes);

    // Apply edits — deriveEditedSetup handles L→R mirroring
    const editedSetup = deriveEditedSetup(rawSetup, rawEdits);

    // Serialize to LSP
    const lspContent = setupToLsp(editedSetup);

    // Determine write path
    const carDir = savedGamesCarDir(setup.relativePath) ?? group.carDir;
    const sourcePath = join(rbrDir, setup.relativePath);
    let targetFileName: string;
    let writePath: string;

    if (args.targetFile) {
      // Explicit target
      targetFileName = args.targetFile;
      writePath = join(rbrDir, "SavedGames", carDir, targetFileName);
    } else if (await isMcpManaged(sourcePath)) {
      // Source is mcp-managed — overwrite in place
      targetFileName = setup.fileName;
      writePath = join(rbrDir, setup.relativePath);
    } else {
      // Source is not mcp-managed — create new file
      const baseName = setup.fileName.replace(/\.lsp$/, "");
      targetFileName = `${baseName}_mcp.lsp`;
      writePath = join(rbrDir, "SavedGames", carDir, targetFileName);
    }

    // Ensure directory exists
    await mkdir(dirname(writePath), { recursive: true });

    // Write LSP file (no header — metadata goes in sidecar)
    await writeFile(writePath, lspContent, "utf-8");

    // Write sidecar metadata file
    await writeMcpSidecar(writePath, {
      base: args.base ?? args.file,
      meta: args.meta,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              writtenTo: writePath,
              fileName: targetFileName,
              changes: previews,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }
}
