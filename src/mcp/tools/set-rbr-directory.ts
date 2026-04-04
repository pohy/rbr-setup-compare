import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { scanRbrDirectory } from "../../lib/rbr-scanner.ts";
import { enrichCarGroups, fetchCarList } from "../car-info.ts";
import { saveConfig } from "../config.ts";
import type { McpContext } from "../context.ts";
import { NodeDirectoryHandle } from "../node-fs-adapter.ts";

export async function setRbrDirectory(
  ctx: McpContext,
  args: { path: string },
): Promise<CallToolResult> {
  const dirPath = args.path;

  // Validate directory exists
  const stats = await stat(dirPath).catch(() => null);
  if (!stats?.isDirectory()) {
    return {
      content: [{ type: "text", text: `Path does not exist or is not a directory: ${dirPath}` }],
      isError: true,
    };
  }

  // Check for expected RBR structure
  const rsfdata = await stat(join(dirPath, "rsfdata")).catch(() => null);
  if (!rsfdata?.isDirectory()) {
    return {
      content: [
        {
          type: "text",
          text: `Path does not look like an RBR install directory (missing rsfdata/): ${dirPath}`,
        },
      ],
      isError: true,
    };
  }

  // Persist config
  await saveConfig(ctx.projectRoot, { rbrDir: dirPath });
  ctx.rbrDir = dirPath;

  // Scan
  const root = new NodeDirectoryHandle(dirPath);
  ctx.carGroups = await scanRbrDirectory(root);

  // Enrich with car specs from carList.ini
  const carList = await fetchCarList(dirPath);
  await enrichCarGroups(ctx.carGroups, carList, dirPath);
  const enriched = ctx.carGroups.filter((g) => g.carInfo).length;

  const setupCount = ctx.carGroups.reduce((n, g) => n + g.setups.length, 0);
  return {
    content: [
      {
        type: "text",
        text: `RBR directory set to: ${dirPath}\nFound ${ctx.carGroups.length} cars with ${setupCount} total setups (${enriched} with car specs).`,
      },
    ],
  };
}
