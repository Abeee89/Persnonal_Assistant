import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const envSchema = z.object({
  DATA_DIR: z.string().min(1).default("./data"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOSTNAME: z.string().min(1).default("127.0.0.1"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ATTACHMENT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  ATTACHMENT_BACKEND: z.enum(["local", "memory"]).default("local"),
  AUTH_ENABLED: booleanFromString,
  AUTH_SECRET: z.string().min(32).optional(),
  AI_ENABLED: booleanFromString,
  AI_ALLOW_REMOTE: booleanFromString,
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.join("\n")}`);
    this.name = "EnvValidationError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }
  if (result.data.AUTH_ENABLED && !result.data.AUTH_SECRET) {
    throw new EnvValidationError([
      "  - AUTH_SECRET: required when AUTH_ENABLED=true",
    ]);
  }
  return result.data;
}
