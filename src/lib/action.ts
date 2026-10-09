import type { z } from "zod";
import { AppError, isAppError, type ErrorCode } from "./errors";
import { logger as defaultLogger } from "./logger";
import { requestId as newRequestId } from "./ids";
import { fail, ok, type ActionResult } from "@/types/result";

export interface ActionLogger {
  warn: (obj: object, msg: string) => void;
  error: (obj: object, msg: string) => void;
}

export interface ActionDeps {
  logger?: ActionLogger;
  requestId?: () => string;
  /**
   * Authorization seam (SDD §09 §1). Runs before validation. Throw AppError("FORBIDDEN")
   * to reject. MVP is local-only, so the default guard allows every call.
   */
  guard?: () => Promise<void> | void;
}

/**
 * Wraps a server action body with the shared contract (SDD §07 §3, §05 §2):
 * - validates input via a Zod schema and maps issues to fieldErrors
 * - converts AppError to a typed failure, everything else to a redacted UNKNOWN
 * - logs failures with a requestId but never the input content
 */
export function defineAction<I, O>(
  name: string,
  schema: z.ZodType<I>,
  handler: (input: I) => Promise<O> | O,
  deps: ActionDeps = {},
): (raw: unknown) => Promise<ActionResult<O>> {
  const log = deps.logger ?? defaultLogger;
  const nextRequestId = deps.requestId ?? newRequestId;
  const guard = deps.guard ?? (() => undefined);

  return async (raw: unknown): Promise<ActionResult<O>> => {
    const id = nextRequestId();
    try {
      await guard();
    } catch (error: unknown) {
      return toFailure(name, id, error, log);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return fail("VALIDATION", "Please fix the highlighted fields.", id, toFieldErrors(parsed.error));
    }
    try {
      const data = await handler(parsed.data);
      return ok(data);
    } catch (error: unknown) {
      return toFailure(name, id, error, log);
    }
  };
}

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function toFailure(
  name: string,
  id: string,
  error: unknown,
  log: ActionLogger,
): ActionResult<never> {
  if (isAppError(error)) {
    log.warn({ requestId: id, action: name, code: error.code }, "action failed");
    return fail(error.code, error.message, id, error.fieldErrors);
  }
  const code: ErrorCode = "UNKNOWN";
  const errorName = error instanceof Error ? error.name : "NonError";
  log.error({ requestId: id, action: name, code, errorName }, "unexpected action error");
  return fail(code, "Something went wrong. Please try again.", id);
}

export { AppError };
