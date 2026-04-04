import { z } from "zod/v4";

export const ChangeEntry = z.object({
  section: z.string().describe("Setup section name (e.g. Car, SpringDamperFront)"),
  key: z.string().describe("Field key within the section"),
  change: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("absolute"),
      value: z.number().describe("New value in display units"),
    }),
    z.object({
      mode: z.literal("relative"),
      percent: z.number().describe("Percentage change from current value (e.g. 5 = +5%)"),
    }),
  ]),
});

export const SetRbrDirectoryInput = z.object({
  path: z.string().min(1).describe("Absolute path to the RBR install directory"),
});

export const ListCarsInput = z.object({});

export const ReadSetupInput = z.object({
  car: z.string().describe("Car name as shown by list_cars"),
  file: z.string().describe("Setup filename (e.g. d_gravel.lsp)"),
});

export const ReadRangesInput = z.object({
  car: z.string().describe("Car name as shown by list_cars"),
  surface: z.string().describe("Surface type (e.g. gravel, tarmac, snow)"),
});

export const CompareSetupsInput = z.object({
  car: z.string().describe("Car name"),
  files: z.array(z.string()).min(2).describe("Two or more setup filenames to compare"),
});

export const ProposeChangeInput = z.object({
  car: z.string(),
  file: z.string(),
  surface: z.string().describe("Surface for range validation"),
  changes: z.array(ChangeEntry).min(1),
});

export const ApplyChangesInput = z.object({
  car: z.string(),
  file: z.string(),
  surface: z.string(),
  changes: z.array(ChangeEntry).min(1),
  targetFile: z
    .string()
    .optional()
    .describe("Output filename. Defaults to source file if mcp-managed, else auto-generated."),
  base: z.string().optional().describe("Base setup filename for tracking in header"),
  meta: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Arbitrary metadata stored in the mcp-managed header"),
});
