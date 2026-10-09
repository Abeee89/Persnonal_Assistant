import type { ErrorCode, FieldErrors } from "@/lib/errors";

export type ActionOk<T> = { ok: true; data: T };

export type ActionErr = {
  ok: false;
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
  requestId: string;
};

export type ActionResult<T> = ActionOk<T> | ActionErr;

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}

export function fail(
  code: ErrorCode,
  message: string,
  requestId: string,
  fieldErrors?: FieldErrors,
): ActionErr {
  return fieldErrors
    ? { ok: false, code, message, requestId, fieldErrors }
    : { ok: false, code, message, requestId };
}
