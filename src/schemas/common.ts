import { z } from "zod";
import { isIsoDay } from "@/lib/domain/dates";
import { parseTimeToMinutes } from "@/lib/domain/duration";

/** Removes C0/C1 control characters except tab and newline. */
export function stripControl(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

/** Single-line text: trim, strip control chars, collapse runs of whitespace. */
export function sanitizeLine(value: string): string {
  return stripControl(value).replace(/\s+/g, " ").trim();
}

/** Multi-line text: strip control chars, normalise CRLF, trim outer whitespace. */
export function sanitizeText(value: string): string {
  return stripControl(value.replace(/\r\n?/g, "\n")).trim();
}

export function line(max: number, label = "This field") {
  return z
    .string({ error: `${label} is required.` })
    .transform(sanitizeLine)
    .pipe(
      z
        .string()
        .min(1, `${label} is required.`)
        .max(max, `${label} must be ${String(max)} characters or fewer.`),
    );
}

export function optionalLine(max: number, label = "This field") {
  return z
    .string()
    .transform(sanitizeLine)
    .pipe(z.string().max(max, `${label} must be ${String(max)} characters or fewer.`))
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);
}

export function multiline(max: number, label = "This field") {
  return z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().max(max, `${label} must be ${String(max)} characters or fewer.`))
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);
}

export const isoDay = z
  .string({ error: "Date is required." })
  .refine(isIsoDay, { message: "Enter a valid date (YYYY-MM-DD)." });

export const optionalIsoDay = z
  .union([isoDay, z.literal("").transform(() => null), z.null()])
  .optional()
  .transform((value) => value ?? null);

export const timeOfDay = z
  .string()
  .refine((value) => parseTimeToMinutes(value) !== null, {
    message: "Enter a time as HH:mm.",
  });

export const optionalTimeOfDay = z
  .union([timeOfDay, z.literal("").transform(() => null), z.null()])
  .optional()
  .transform((value) => value ?? null);

export const scale15 = z
  .number({ error: "Choose a value from 1 to 5." })
  .int("Choose a value from 1 to 5.")
  .min(1, "Choose a value from 1 to 5.")
  .max(5, "Choose a value from 1 to 5.");

export const optionalScale15 = z
  .union([scale15, z.null()])
  .optional()
  .transform((value) => value ?? null);

export const entityId = z.string().min(1, "Missing identifier.").max(64);

export const tagName = z
  .string()
  .transform(sanitizeLine)
  .pipe(
    z
      .string()
      .min(1)
      .max(24, "Tags must be 24 characters or fewer.")
      .transform((value) => value.toLowerCase()),
  );

export const tagList = z
  .array(tagName)
  .max(20, "Use at most 20 tags.")
  .transform((tags) => [...new Set(tags)]);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
