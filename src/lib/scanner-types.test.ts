import { describe, expect, it } from "vitest";
import { formatCarName, RANGE_FILE_RE, RSF_DEFAULT_COPY_RE } from "./scanner-types.ts";

describe("formatCarName", () => {
  it("strips _ngp6 suffix and replaces underscores with spaces", () => {
    expect(formatCarName("Skoda_Fabia_S2000_Evo_2_ngp6")).toBe("Skoda Fabia S2000 Evo 2");
  });

  it("handles case-insensitive _ngp6 suffix", () => {
    expect(formatCarName("MANTA400_NGP6")).toBe("MANTA400");
  });

  it("works when there is no _ngp6 suffix", () => {
    expect(formatCarName("Some_Car_Name")).toBe("Some Car Name");
  });

  it("handles single-word names", () => {
    expect(formatCarName("Impreza03_ngp6")).toBe("Impreza03");
  });
});

describe("RANGE_FILE_RE", () => {
  it("matches range files and extracts surface", () => {
    const match = "r_gravel.lsp".match(RANGE_FILE_RE);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("gravel");
  });

  it("matches multi-word surface names", () => {
    const match = "r_gravel_dry.lsp".match(RANGE_FILE_RE);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("gravel_dry");
  });

  it("does not match non-range lsp files", () => {
    expect("setup.lsp".match(RANGE_FILE_RE)).toBeNull();
    expect("d_gravel.lsp".match(RANGE_FILE_RE)).toBeNull();
  });

  it("does not match range files without .lsp extension", () => {
    expect("r_gravel.txt".match(RANGE_FILE_RE)).toBeNull();
  });
});

describe("RSF_DEFAULT_COPY_RE", () => {
  it("matches RSF default copy filenames", () => {
    expect(RSF_DEFAULT_COPY_RE.test("1_d_setup.lsp")).toBe(true);
    expect(RSF_DEFAULT_COPY_RE.test("42_d_something.lsp")).toBe(true);
  });

  it("does not match user setup filenames", () => {
    expect(RSF_DEFAULT_COPY_RE.test("my_setup.lsp")).toBe(false);
    expect(RSF_DEFAULT_COPY_RE.test("d_gravel.lsp")).toBe(false);
  });
});
