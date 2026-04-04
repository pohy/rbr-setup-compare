import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { join } from "node:path";

const LOG_FILE = "rbr-tuner.log";

export type Logger = {
  log(level: string, ...args: unknown[]): void;
  flush(): void;
  close(): void;
  /** Redirect console.log and console.error to this logger. */
  install(): void;
};

export function createLogger(projectRoot: string): Logger {
  mkdirSync(projectRoot, { recursive: true });
  const fd = openSync(join(projectRoot, LOG_FILE), "a");
  function log(level: string, ...args: unknown[]) {
    const ts = new Date().toISOString();
    const msg = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
    writeSync(fd, `${ts} [${level}] ${msg}\n`);
  }

  function flush() {
    // No-op: writes are immediate. Kept for API compatibility.
  }

  function close() {
    flush();
    closeSync(fd);
  }

  function install() {
    console.log = (...args: unknown[]) => {
      log("log", ...args);
      flush();
    };
    console.error = (...args: unknown[]) => {
      log("error", ...args);
      flush();
    };
    console.warn = (...args: unknown[]) => {
      log("warn", ...args);
      flush();
    };
  }

  return { log, flush, close, install };
}
