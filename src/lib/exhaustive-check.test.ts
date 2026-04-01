import { describe, expect, it } from "vitest";
import { exhaustiveCheck } from "./exhaustive-check.ts";

describe("exhaustiveCheck", () => {
  it("throws with the unhandled value in the message", () => {
    const value = "surprise" as never;
    expect(() => exhaustiveCheck(value)).toThrow("surprise");
  });
});
