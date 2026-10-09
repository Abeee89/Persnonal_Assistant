export const ERROR_CODES = [
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "FORBIDDEN",
  "FILE_TOO_LARGE",
  "FILE_TYPE_UNSUPPORTED",
  "INSUFFICIENT_STORAGE",
  "STORAGE",
  "DB",
  "UNKNOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  FORBIDDEN: 403,
  FILE_TOO_LARGE: 413,
  FILE_TYPE_UNSUPPORTED: 415,
  INSUFFICIENT_STORAGE: 507,
  STORAGE: 500,
  DB: 500,
  UNKNOWN: 500,
};

export type FieldErrors = Record<string, string[]>;

/**
 * Expected, user-meaningful failure. Its message is safe to show to the user.
 * Anything not an AppError is treated as UNKNOWN and redacted.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors: FieldErrors | undefined;

  constructor(code: ErrorCode, message: string, options?: { fieldErrors?: FieldErrors; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
