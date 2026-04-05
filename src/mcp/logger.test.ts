import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger, type Logger } from "./logger.ts";

const TEST_DIR = join(tmpdir(), "rbr-mcp-logger-test");
const LOG_FILE = join(TEST_DIR, "rbr-tuner.log");

let logger: Logger;

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

afterEach(() => {
  logger?.close();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("createLogger", () => {
  it("creates log file and writes entries", () => {
    logger = createLogger(TEST_DIR);
    logger.log("info", "hello world");
    logger.flush();

    const content = readFileSync(LOG_FILE, "utf-8");
    expect(content).toContain("hello world");
    expect(content).toContain("[info]");
  });

  it("includes ISO timestamp in log entries", () => {
    logger = createLogger(TEST_DIR);
    logger.log("info", "timestamp test");
    logger.flush();

    const content = readFileSync(LOG_FILE, "utf-8");
    // Should contain ISO-like date pattern
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("handles multiple arguments", () => {
    logger = createLogger(TEST_DIR);
    logger.log("info", "count:", 42, "items");
    logger.flush();

    const content = readFileSync(LOG_FILE, "utf-8");
    expect(content).toContain("count: 42 items");
  });

  it("supports different log levels", () => {
    logger = createLogger(TEST_DIR);
    logger.log("error", "bad thing");
    logger.log("warn", "careful");
    logger.log("debug", "details");
    logger.flush();

    const content = readFileSync(LOG_FILE, "utf-8");
    expect(content).toContain("[error]");
    expect(content).toContain("[warn]");
    expect(content).toContain("[debug]");
  });

  it("appends to existing log file", () => {
    logger = createLogger(TEST_DIR);
    logger.log("info", "first");
    logger.flush();
    logger.close();

    logger = createLogger(TEST_DIR);
    logger.log("info", "second");
    logger.flush();

    const content = readFileSync(LOG_FILE, "utf-8");
    expect(content).toContain("first");
    expect(content).toContain("second");
  });
});

describe("console redirection", () => {
  it("redirects console.log to log file", () => {
    const origLog = console.log;
    logger = createLogger(TEST_DIR);
    logger.install();

    console.log("redirected message");
    logger.flush();

    console.log = origLog;

    const content = readFileSync(LOG_FILE, "utf-8");
    expect(content).toContain("redirected message");
  });

  it("redirects console.error to log file", () => {
    const origError = console.error;
    logger = createLogger(TEST_DIR);
    logger.install();

    console.error("error message");
    logger.flush();

    console.error = origError;

    const content = readFileSync(LOG_FILE, "utf-8");
    expect(content).toContain("error message");
  });
});
