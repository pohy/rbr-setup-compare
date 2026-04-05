import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatCarSummary } from "../car-info.ts";
import { type McpContext, requireRbrDir } from "../context.ts";
import { readMcpSidecar } from "../mcp-managed.ts";

export async function listCars(ctx: McpContext): Promise<CallToolResult> {
  try {
    requireRbrDir(ctx);
  } catch (e) {
    return { content: [{ type: "text", text: (e as Error).message }], isError: true };
  }

  const result = await Promise.all(
    ctx.carGroups.map(async (group) => {
      const rbrDir = ctx.rbrDir as string;
      const setups = await Promise.all(
        group.setups.map(async (s) => {
          const sidecar = await readMcpSidecar(join(rbrDir, s.relativePath));
          return {
            fileName: s.fileName,
            source: s.source,
            relativePath: s.relativePath,
            mcpManaged: sidecar,
          };
        }),
      );
      return {
        carName: group.carName,
        carDir: group.carDir,
        summary: group.carInfo ? formatCarSummary(group.carInfo) : null,
        setups,
        surfaces: group.rangeFiles.map((r) => r.surface),
      };
    }),
  );

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
