import { NextResponse } from "next/server";
import { AppError, HTTP_STATUS, isAppError, type ErrorCode, type FieldErrors } from "./errors";
import { logger } from "./logger";
import { requestId } from "./ids";

export interface ErrorEnvelope {
  ok: false;
  error: { code: ErrorCode; message: string; requestId: string; fieldErrors?: FieldErrors };
}

/** Maps any thrown value to the JSON error envelope (SDD §07 §5). Never leaks internals. */
export function errorResponse(error: unknown, id: string = requestId()): NextResponse<ErrorEnvelope> {
  if (isAppError(error)) {
    logger.warn({ requestId: id, code: error.code }, "request failed");
    const body: ErrorEnvelope = {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        requestId: id,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    };
    return NextResponse.json(body, { status: HTTP_STATUS[error.code] });
  }
  const errorName = error instanceof Error ? error.name : "NonError";
  logger.error({ requestId: id, code: "UNKNOWN", errorName }, "unexpected request error");
  return NextResponse.json(
    { ok: false, error: { code: "UNKNOWN", message: "Something went wrong. Please try again.", requestId: id } },
    { status: HTTP_STATUS.UNKNOWN },
  );
}

/**
 * Rejects cross-site state-changing requests (SDD §09 §4 CSRF). Allows requests
 * with no Origin header (same-origin GET / non-browser tools are not CSRF vectors
 * for this app) and requests whose Origin matches the Host header.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return;
  }
  const host = request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Request origin is not allowed.");
  }
  if (host === null || originHost !== host) {
    throw new AppError("FORBIDDEN", "Request origin is not allowed.");
  }
}
