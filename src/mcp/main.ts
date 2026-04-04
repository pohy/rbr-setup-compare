import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { scanRbrDirectory } from "../lib/rbr-scanner.ts";
import { enrichCarGroups, fetchCarList } from "./car-info.ts";
import { loadConfig } from "./config.ts";
import type { McpContext } from "./context.ts";
import { createLogger } from "./logger.ts";
import { NodeDirectoryHandle } from "./node-fs-adapter.ts";
import {
  ApplyChangesInput,
  CompareSetupsInput,
  ListCarsInput,
  ProposeChangeInput,
  ReadRangesInput,
  ReadSetupInput,
  SetRbrDirectoryInput,
} from "./schemas.ts";
import { applyChanges } from "./tools/apply-changes.ts";
import { compareSetups } from "./tools/compare-setups.ts";
import { listCars } from "./tools/list-cars.ts";
import { proposeChange } from "./tools/propose-change.ts";
import { readRanges } from "./tools/read-ranges.ts";
import { readSetup } from "./tools/read-setup.ts";
import { setRbrDirectory } from "./tools/set-rbr-directory.ts";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// Install file logger before anything else — redirects console.log/error
// so scanner output doesn't corrupt the stdio JSON-RPC stream
const logger = createLogger(projectRoot);
logger.install();
logger.log("info", "rbrtune starting");

function logged(
  name: string,
  fn: (args: Record<string, unknown>) => Promise<CallToolResult>,
): (args: Record<string, unknown>) => Promise<CallToolResult> {
  return async (args) => {
    logger.log("info", `[tool] ${name} called`, JSON.stringify(args));
    try {
      const result = await fn(args);
      if (result.isError) {
        const text = result.content[0];
        logger.log(
          "error",
          `[tool] ${name} failed:`,
          text && "text" in text ? text.text : "unknown error",
        );
      } else {
        logger.log("info", `[tool] ${name} ok`);
      }
      return result;
    } catch (e) {
      logger.log("error", `[tool] ${name} threw:`, String(e));
      throw e;
    }
  };
}

const ctx: McpContext = {
  projectRoot,
  rbrDir: null,
  carGroups: [],
};

// Try loading saved config
const config = await loadConfig(projectRoot);
if (config) {
  ctx.rbrDir = config.rbrDir;
  try {
    const root = new NodeDirectoryHandle(config.rbrDir);
    ctx.carGroups = await scanRbrDirectory(root);
    const carList = await fetchCarList(config.rbrDir);
    await enrichCarGroups(ctx.carGroups, carList, config.rbrDir);
    const enriched = ctx.carGroups.filter((g) => g.carInfo).length;
    logger.log(
      "info",
      `Loaded ${ctx.carGroups.length} cars from ${config.rbrDir} (${enriched} with specs)`,
    );
  } catch (e) {
    logger.log("error", `Failed to scan saved directory: ${e}`);
  }
}

const server = new McpServer({
  name: "rbrtune",
  version: "0.1.0",
});

server.registerTool(
  "set_rbr_directory",
  {
    description: "Set the path to the RBR install directory. Must be called before other tools.",
    inputSchema: SetRbrDirectoryInput.shape,
  },
  logged("set_rbr_directory", (args) => setRbrDirectory(ctx, args as { path: string })),
);

server.registerTool(
  "list_cars",
  {
    description: "List available cars, their setup files, range surfaces, and MCP-managed status.",
    inputSchema: ListCarsInput.shape,
  },
  logged("list_cars", () => listCars(ctx)),
);

server.registerTool(
  "read_setup",
  {
    description:
      "Read and parse a setup file. Returns sections with display values, labels, and units. Use the section names from this output directly in propose_change/apply_changes.",
    inputSchema: ReadSetupInput.shape,
  },
  logged("read_setup", (args) => readSetup(ctx, args as { car: string; file: string })),
);

server.registerTool(
  "read_ranges",
  {
    description: "Read valid min/max/step ranges for a car on a given surface.",
    inputSchema: ReadRangesInput.shape,
  },
  logged("read_ranges", (args) => readRanges(ctx, args as { car: string; surface: string })),
);

server.registerTool(
  "compare_setups",
  {
    description: "Compare two or more setup files side by side, showing differences.",
    inputSchema: CompareSetupsInput.shape,
  },
  logged("compare_setups", (args) => compareSetups(ctx, args as { car: string; files: string[] })),
);

server.registerTool(
  "propose_change",
  {
    description:
      "Preview changes to a setup without writing. Shows before/after values and clamping. Use section names from read_setup (e.g. SpringDamperBack, TyreFront). Only specify one side — the other is mirrored automatically.",
    inputSchema: ProposeChangeInput.shape,
  },
  logged("propose_change", (args) =>
    proposeChange(ctx, args as Parameters<typeof proposeChange>[1]),
  ),
);

server.registerTool(
  "apply_changes",
  {
    description:
      "Apply validated changes to a setup and write to disk. Creates MCP-managed files. Use section names from read_setup. Only specify one side — the other is mirrored automatically.",
    inputSchema: ApplyChangesInput.shape,
  },
  logged("apply_changes", (args) => applyChanges(ctx, args as Parameters<typeof applyChanges>[1])),
);

const transport = new StdioServerTransport();
await server.connect(transport);
