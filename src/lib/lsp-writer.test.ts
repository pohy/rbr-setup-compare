import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarSetup } from "./lsp-parser.ts";
import { parseLspSetup, tokenize } from "./lsp-parser.ts";
import { setupToLsp } from "./lsp-writer.ts";

const DATA_DIR = resolve(process.cwd(), "data");

function readSetup(path: string): string {
  return readFileSync(resolve(DATA_DIR, path), "utf-8");
}

describe("setupToLsp", () => {
  describe("round-trip with real files", () => {
    it.each([
      "Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp",
      "Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_gravel.lsp",
      "Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_snow.lsp",
      "gravel_M3E30_Cubits.lsp",
    ])("%s round-trips correctly", (filename) => {
      const text = readSetup(filename);
      const parsed = parseLspSetup(text, filename);
      const serialized = setupToLsp(parsed);
      const reparsed = parseLspSetup(serialized, filename);

      expect(Object.keys(reparsed.sections).sort()).toEqual(Object.keys(parsed.sections).sort());

      for (const [name, section] of Object.entries(parsed.sections)) {
        expect(reparsed.sections[name]).toBeDefined();
        expect(reparsed.sections[name].id).toBe(section.id);
        expect(reparsed.sections[name].values).toEqual(section.values);
      }
    });
  });

  describe("output format validity", () => {
    it('starts with (("CarSetup"', () => {
      const text = readSetup("Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp");
      const parsed = parseLspSetup(text, "test");
      const output = setupToLsp(parsed);
      expect(output.startsWith('(("CarSetup"')).toBe(true);
    });

    it("ends with ))\\n", () => {
      const text = readSetup("Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp");
      const parsed = parseLspSetup(text, "test");
      const output = setupToLsp(parsed);
      expect(output.endsWith("))\n")).toBe(true);
    });

    it("is re-parseable by parseLspSetup without throwing", () => {
      const text = readSetup("Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp");
      const parsed = parseLspSetup(text, "test");
      const output = setupToLsp(parsed);
      expect(() => parseLspSetup(output, "test")).not.toThrow();
    });
  });

  describe("section ordering", () => {
    it("emits sections in canonical order", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          TyreRB: { id: ":-D", values: { Pressure: 200000 } },
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
          Drive: { id: ":-D", values: { FrontDiffMaxTorque: 90 } },
          WheelLF: { id: ":-D", values: { TopMountSlot: 3 } },
        },
      };
      const output = setupToLsp(setup);
      const lines = output.split("\n");
      const sectionLines = lines.filter((l) => /^\s{2}\w/.test(l)).map((l) => l.trim());

      // Engine is always restored; WheelRF is restored from WheelLF by restoreMirroredSections
      expect(sectionLines).toEqual(["Car", "Drive", "Engine", "WheelLF", "WheelRF", "TyreRB"]);
    });

    it("appends unknown sections at the end", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          CustomSection: { id: ":-D", values: { Foo: 1 } },
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
        },
      };
      const output = setupToLsp(setup);
      const lines = output.split("\n");
      const sectionLines = lines.filter((l) => /^\s{2}\w/.test(l)).map((l) => l.trim());

      expect(sectionLines).toEqual(["Car", "Engine", "CustomSection"]);
    });
  });

  describe("section IDs", () => {
    it("preserves original IDs when non-empty", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "MyCar", values: { MaxSteeringLock: 0.75 } },
          Drive: { id: "MyDrive", values: { FrontDiffMaxTorque: 90 } },
        },
      };
      const output = setupToLsp(setup);
      expect(output).toContain('("MyCar"');
      expect(output).toContain('("MyDrive"');
    });

    it('defaults Car section id to "Car" when empty', () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "", values: { MaxSteeringLock: 0.75 } },
        },
      };
      const output = setupToLsp(setup);
      expect(output).toContain('("Car"');
    });

    it('defaults other section ids to ":-D" when empty', () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Drive: { id: "", values: { FrontDiffMaxTorque: 90 } },
        },
      };
      const output = setupToLsp(setup);
      expect(output).toContain('(":-D"');
    });
  });

  describe("number formatting", () => {
    it("formats integers without decimal point", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "Car", values: { FrontRollBarStiffness: 20000 } },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");
      expect(reparsed.sections.Car.values.FrontRollBarStiffness).toBe(20000);
    });

    it("formats floats correctly", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");
      expect(reparsed.sections.Car.values.MaxSteeringLock).toBe(0.75);
    });

    it("cleans floating-point noise", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "Car", values: { Value: 0.30000000000000004 } },
        },
      };
      const output = setupToLsp(setup);
      expect(output).toContain("0.3");
      expect(output).not.toContain("0.30000000000000004");
    });

    it("preserves multi-value strings correctly", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          WheelLF: {
            id: ":-D",
            values: { Position: "0.45161 -0.180669 0.015" },
          },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");
      expect(reparsed.sections.WheelLF.values.Position).toBe("0.45161 -0.180669 0.015");
    });
  });

  describe("edge cases", () => {
    it("handles setup with a single section", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");
      expect(Object.keys(reparsed.sections).sort()).toEqual(["Car", "Engine"]);
      expect(reparsed.sections.Car.values.MaxSteeringLock).toBe(0.75);
    });

    it("omits sections with empty values", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
          Drive: { id: ":-D", values: {} },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");
      expect(reparsed.sections.Drive).toBeUndefined();
    });

    it("appends sections not in canonical order at end", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          ExtraStuff: { id: ":-D", values: { Foo: 42 } },
          AnotherCustom: { id: ":-D", values: { Bar: 99 } },
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
        },
      };
      const output = setupToLsp(setup);
      const lines = output.split("\n");
      const sectionLines = lines.filter((l) => /^\s{2}\w/.test(l)).map((l) => l.trim());

      // Car first (canonical), Engine restored, then custom sections
      expect(sectionLines[0]).toBe("Car");
      expect(sectionLines.slice(1).sort()).toEqual(["AnotherCustom", "Engine", "ExtraStuff"]);
    });
  });

  describe("mirrored section restoration", () => {
    it("restores RF/RB sections from LF/LB-only setup", () => {
      const setup: CarSetup = {
        name: "url-hydrated",
        sections: {
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
          SpringDamperLF: {
            id: ":-D",
            values: { SpringStiffness: 50000 },
            rawValues: { SpringStiffness: "50000" },
          },
          SpringDamperLB: { id: ":-D", values: { SpringStiffness: 40000 } },
          TyreLF: { id: ":-D", values: { Pressure: 200000 } },
          TyreLB: { id: ":-D", values: { Pressure: 180000 } },
          WheelLF: { id: ":-D", values: { TopMountSlot: 3 } },
          WheelLB: { id: ":-D", values: { TopMountSlot: 2 } },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");

      // RF/RB sections should exist with same values as LF/LB
      expect(reparsed.sections.SpringDamperRF.values).toEqual({ SpringStiffness: 50000 });
      expect(reparsed.sections.SpringDamperRB.values).toEqual({ SpringStiffness: 40000 });
      expect(reparsed.sections.TyreRF.values).toEqual({ Pressure: 200000 });
      expect(reparsed.sections.TyreRB.values).toEqual({ Pressure: 180000 });
      expect(reparsed.sections.WheelRF.values).toEqual({ TopMountSlot: 3 });
      expect(reparsed.sections.WheelRB.values).toEqual({ TopMountSlot: 2 });
    });

    it("does not overwrite existing RF/RB sections", () => {
      const setup: CarSetup = {
        name: "full-setup",
        sections: {
          WheelLF: { id: ":-D", values: { TopMountSlot: 3 } },
          WheelRF: { id: "custom", values: { TopMountSlot: 5 } },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");

      expect(reparsed.sections.WheelRF.values.TopMountSlot).toBe(5);
      expect(reparsed.sections.WheelRF.id).toBe("custom");
    });
  });

  describe("canonical key ordering", () => {
    function extractSectionKeys(output: string, sectionName: string): string[] {
      const lines = output.split("\n");
      const keys: string[] = [];
      let inSection = false;
      for (const line of lines) {
        if (new RegExp(`^\\s{2}${sectionName}$`).test(line)) {
          inSection = true;
          continue;
        }
        if (inSection && /^\s{2}\w/.test(line)) break; // next section
        if (inSection && /^\s{3}\w/.test(line)) {
          keys.push(line.trim().split(/\t/)[0]);
        }
      }
      return keys;
    }

    it("sorts keys within a section by SETUP_SCHEMA order", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          SpringDamperLF: {
            id: ":-D",
            values: {
              // Deliberately reversed vs schema order (SpringLength, SpringStiffness, ...)
              DampingRebound: 3000,
              SpringStiffness: 50000,
              SpringLength: 0.22,
            },
          },
        },
      };
      const output = setupToLsp(setup);
      const keyLines = extractSectionKeys(output, "SpringDamperLF");

      expect(keyLines).toEqual(["SpringLength", "SpringStiffness", "DampingRebound"]);
    });

    it("puts non-schema keys at the end in insertion order", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          SpringDamperLF: {
            id: ":-D",
            values: {
              CustomKey: 999,
              SpringStiffness: 50000,
              AnotherCustom: 123,
              SpringLength: 0.22,
            },
          },
        },
      };
      const output = setupToLsp(setup);
      const keyLines = extractSectionKeys(output, "SpringDamperLF");

      // Schema keys first in schema order, then custom keys in insertion order
      expect(keyLines).toEqual(["SpringLength", "SpringStiffness", "CustomKey", "AnotherCustom"]);
    });
  });

  describe("Engine section restoration", () => {
    it("restores Engine section with Features_NGP when missing", () => {
      const setup: CarSetup = {
        name: "url-hydrated",
        sections: {
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
          Drive: { id: ":-D", values: { FrontDiffMaxTorque: 90 } },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");

      expect(reparsed.sections.Engine).toBeDefined();
      expect(reparsed.sections.Engine.values.Features_NGP).toBe(0);
    });

    it("does not overwrite existing Engine section", () => {
      const setup: CarSetup = {
        name: "test",
        sections: {
          Car: { id: "Car", values: { MaxSteeringLock: 0.75 } },
          Engine: { id: ":-D", values: { Features_NGP: 0, Dummy: 42 } },
        },
      };
      const output = setupToLsp(setup);
      const reparsed = parseLspSetup(output, "test");

      expect(reparsed.sections.Engine.values.Dummy).toBe(42);
      expect(reparsed.sections.Engine.values.Features_NGP).toBe(0);
    });
  });

  describe("raw value preservation", () => {
    it.each([
      "Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp",
      "Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_gravel.lsp",
      "Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_snow.lsp",
    ])("%s has exact token match after round-trip", (filename) => {
      const text = readSetup(filename);
      const parsed = parseLspSetup(text, filename);
      const serialized = setupToLsp(parsed);

      const originalTokens = tokenize(text);
      const serializedTokens = tokenize(serialized);
      expect(serializedTokens).toEqual(originalTokens);
    });

    it("gravel_M3E30_Cubits.lsp preserves all raw values after round-trip", () => {
      const text = readSetup("gravel_M3E30_Cubits.lsp");
      const parsed = parseLspSetup(text, "cubits");
      const serialized = setupToLsp(parsed);
      const serializedTokens = tokenize(serialized);

      for (const section of Object.values(parsed.sections)) {
        if (!section.rawValues) continue;
        for (const raw of Object.values(section.rawValues)) {
          const rawParts = raw.split(" ");
          for (const part of rawParts) {
            expect(serializedTokens).toContain(part);
          }
        }
      }
    });
  });
});
