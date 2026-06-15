import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

// The single logging pipeline for the API. index.ts passes this instance to
// Fastify ({ logger }) so request logs and app logs share one stream/format.
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    remove: false,
  },
});

type Level = "debug" | "info" | "warn" | "error";

// console-compatible facade: accepts varargs like console.* but emits through
// pino. An Error anywhere in the args is lifted into pino's { err } serializer;
// everything else is joined into the message (predictable, grep-friendly).
function emit(level: Level, args: unknown[]): void {
  let err: Error | undefined;
  const parts: string[] = [];
  for (const a of args) {
    if (a instanceof Error && !err) {
      err = a;
    } else if (typeof a === "string") {
      parts.push(a);
    } else {
      try {
        parts.push(typeof a === "object" && a !== null ? JSON.stringify(a) : String(a));
      } catch {
        parts.push(String(a));
      }
    }
  }
  const msg = parts.join(" ").trim();
  if (err) {
    logger[level]({ err }, msg || err.message);
  } else {
    logger[level](msg);
  }
}

export const log = {
  log: (...a: unknown[]) => emit("info", a),
  info: (...a: unknown[]) => emit("info", a),
  warn: (...a: unknown[]) => emit("warn", a),
  error: (...a: unknown[]) => emit("error", a),
  debug: (...a: unknown[]) => emit("debug", a),
};
