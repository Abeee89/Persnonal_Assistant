import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, isAppError } from "./errors";
import { defineAction, toFailure } from "./action";
import { redactContent, REDACTED, createLogger } from "./logger";
import { uuidv7 } from "./ids";
import { fail, ok } from "@/types/result";

const silentLog = { warn: vi.fn(), error: vi.fn() };

describe("uuidv7", () => {
  it("produces a v7 RFC 9562 string", () => {
    const id = uuidv7(1_700_000_000_000);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("encodes the timestamp in the first 48 bits (time-ordered)", () => {
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_000_500);
    expect(earlier.slice(0, 13) < later.slice(0, 13)).toBe(true);
  });

  it("is unique across calls with the same timestamp", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uuidv7(1_700_000_000_000)));
    expect(ids.size).toBe(500);
  });

  it("rejects out-of-range timestamps", () => {
    expect(() => uuidv7(-1)).toThrow(RangeError);
    expect(() => uuidv7(1.5)).toThrow(RangeError);
  });
});

describe("result contract", () => {
  it("ok wraps data", () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
  });

  it("fail omits fieldErrors when absent", () => {
    expect(fail("NOT_FOUND", "gone", "r1")).toEqual({ ok: false, code: "NOT_FOUND", message: "gone", requestId: "r1" });
  });
});

describe("AppError", () => {
  it("carries code and field errors", () => {
    const err = new AppError("VALIDATION", "bad", { fieldErrors: { title: ["required"] } });
    expect(isAppError(err)).toBe(true);
    expect(err.code).toBe("VALIDATION");
    expect(err.fieldErrors).toEqual({ title: ["required"] });
  });

  it("is not confused with plain errors", () => {
    expect(isAppError(new Error("x"))).toBe(false);
  });
});

describe("toFailure", () => {
  it("passes AppError messages through", () => {
    const result = toFailure("act.create", "r1", new AppError("CONFLICT", "Already exists."), silentLog);
    expect(result).toEqual({ ok: false, code: "CONFLICT", message: "Already exists.", requestId: "r1" });
  });

  it("redacts unknown errors to a generic UNKNOWN message", () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const result = toFailure("act.create", "r2", new Error("SECRET DB PATH /var/x"), log);
    expect(result).toEqual({
      ok: false,
      code: "UNKNOWN",
      message: "Something went wrong. Please try again.",
      requestId: "r2",
    });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "r2", code: "UNKNOWN", errorName: "Error" }),
      expect.any(String),
    );
  });
});

describe("defineAction", () => {
  const schema = z.object({ title: z.string().min(1), n: z.number().int() });
  const deps = { logger: silentLog, requestId: () => "req-1" };

  it("returns validation field errors without running the handler", async () => {
    const handler = vi.fn();
    const action = defineAction("t.create", schema, handler, deps);
    const result = await action({ title: "", n: 1.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
      expect(result.fieldErrors).toHaveProperty("title");
      expect(result.fieldErrors).toHaveProperty("n");
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler with parsed input and wraps data", async () => {
    const action = defineAction("t.create", schema, (input) => ({ echo: input.title }), deps);
    await expect(action({ title: "Coding", n: 2 })).resolves.toEqual({ ok: true, data: { echo: "Coding" } });
  });

  it("maps thrown AppError into a typed failure", async () => {
    const action = defineAction(
      "t.create",
      schema,
      () => {
        throw new AppError("NOT_FOUND", "Activity not found.");
      },
      deps,
    );
    await expect(action({ title: "x", n: 1 })).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Activity not found.",
      requestId: "req-1",
    });
  });

  it("never leaks unexpected error messages", async () => {
    const action = defineAction(
      "t.create",
      schema,
      () => {
        throw new Error("ENOENT /secret/path");
      },
      deps,
    );
    const result = await action({ title: "x", n: 1 });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.ok).toBe(false);
  });
});

describe("redactContent", () => {
  it("redacts journal and content keys at any depth", () => {
    const out = redactContent({
      requestId: "r",
      entity: { id: "1", contentPlain: "private words", nested: { description: "x" } },
      query: "visa",
    });
    expect(out).toEqual({
      requestId: "r",
      entity: { id: "1", contentPlain: REDACTED, nested: { description: REDACTED } },
      query: REDACTED,
    });
  });

  it("keeps non-sensitive primitives untouched", () => {
    expect(redactContent({ count: 3, code: "DB" })).toEqual({ count: 3, code: "DB" });
  });
});

describe("logger", () => {
  it("never writes content fields to the output stream", () => {
    const lines: string[] = [];
    const stream = { write: (chunk: string) => { lines.push(chunk); } };
    const log = createLogger("info", stream);
    log.info({ contentPlain: "my diary", requestId: "r9" }, "saved");
    const line = lines.join("");
    expect(line).toContain("r9");
    expect(line).not.toContain("my diary");
    expect(line).toContain(REDACTED);
  });
});
