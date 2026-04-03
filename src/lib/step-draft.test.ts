import { describe, expect, it } from "vitest";
import { stepDraft } from "./step-draft.ts";

describe("stepDraft", () => {
  describe("with range", () => {
    const range = { min: 0, max: 100, step: 5 };

    it("steps up by range.step", () => {
      expect(stepDraft("50", 1, false, range)).toBe("55");
    });

    it("steps down by range.step", () => {
      expect(stepDraft("50", -1, false, range)).toBe("45");
    });

    it("clamps to max", () => {
      expect(stepDraft("100", 1, false, range)).toBe("100");
    });

    it("clamps to min", () => {
      expect(stepDraft("0", -1, false, range)).toBe("0");
    });

    it("snaps to grid", () => {
      expect(stepDraft("52", 1, false, range)).toBe("55");
    });

    it("uses step/10 when fine", () => {
      expect(stepDraft("50", 1, true, range)).toBe("50.5");
    });

    it("handles decimal range step", () => {
      const r = { min: 0, max: 1, step: 0.1 };
      expect(stepDraft("0.5", 1, false, r)).toBe("0.6");
    });
  });

  describe("without range (fallback)", () => {
    it("derives step=1 for integers", () => {
      expect(stepDraft("50", 1, false)).toBe("51");
    });

    it("derives step=0.1 for one decimal place", () => {
      expect(stepDraft("1.5", 1, false)).toBe("1.6");
    });

    it("derives step=0.01 for two decimal places", () => {
      expect(stepDraft("1.25", -1, false)).toBe("1.24");
    });

    it("uses step/10 when fine for integers", () => {
      expect(stepDraft("50", 1, true)).toBe("50.1");
    });

    it("uses step/10 when fine for decimals", () => {
      expect(stepDraft("1.5", 1, true)).toBe("1.51");
    });

    it("avoids floating-point drift", () => {
      expect(stepDraft("0.1", 1, false)).toBe("0.2");
    });
  });

  describe("edge cases", () => {
    it("returns null for non-numeric input", () => {
      expect(stepDraft("abc", 1, false)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(stepDraft("", 1, false)).toBeNull();
    });

    it("handles negative values", () => {
      expect(stepDraft("-5", 1, false)).toBe("-4");
    });

    it("handles fallbackStep override", () => {
      expect(stepDraft("50", 1, false, undefined, 10)).toBe("60");
    });

    it("uses fallbackStep/10 when fine", () => {
      expect(stepDraft("50", 1, true, undefined, 10)).toBe("51");
    });
  });
});
