import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("applies safe local defaults when nothing is set", () => {
    const env = parseEnv({});
    expect(env.HOSTNAME).toBe("127.0.0.1");
    expect(env.DATA_DIR).toBe("./data");
    expect(env.PORT).toBe(3000);
    expect(env.AUTH_ENABLED).toBe(false);
    expect(env.AI_ENABLED).toBe(false);
    expect(env.AI_ALLOW_REMOTE).toBe(false);
    expect(env.ATTACHMENT_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it("coerces numeric and boolean strings", () => {
    const env = parseEnv({ PORT: "4100", AUTH_ENABLED: "false" });
    expect(env.PORT).toBe(4100);
    expect(env.AUTH_ENABLED).toBe(false);
  });

  it("rejects invalid values with readable issues", () => {
    expect(() => parseEnv({ PORT: "99999" })).toThrow(EnvValidationError);
    expect(() => parseEnv({ LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/);
  });

  it("requires AUTH_SECRET when auth is enabled", () => {
    expect(() => parseEnv({ AUTH_ENABLED: "true" })).toThrow(/AUTH_SECRET/);
    expect(() =>
      parseEnv({ AUTH_ENABLED: "true", AUTH_SECRET: "x".repeat(32) }),
    ).not.toThrow();
  });
});
