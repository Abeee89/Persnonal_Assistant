import pino, { type Logger } from "pino";

/**
 * Keys that must never be logged, even accidentally (SDD §12 §5).
 * Journal bodies, activity text, attachment names and search terms are content.
 */
const FORBIDDEN_KEYS = [
  "content",
  "contentJson",
  "contentPlain",
  "description",
  "notes",
  "body",
  "originalName",
  "query",
  "q",
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
];

export const REDACTED = "[redacted]";

export function redactContent(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactContent(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = FORBIDDEN_KEYS.includes(key) ? REDACTED : redactContent(inner, depth + 1);
  }
  return out;
}

export function createLogger(level: string = "info", destination?: pino.DestinationStream): Logger {
  return pino(
    {
      level,
      base: { app: "personal-activity" },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        log(object) {
          return redactContent(object) as Record<string, unknown>;
        },
      },
    },
    destination,
  );
}

export const logger: Logger = createLogger(process.env.LOG_LEVEL ?? "info");
