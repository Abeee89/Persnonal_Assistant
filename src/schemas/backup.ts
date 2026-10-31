import { z } from "zod";

/** A single exported row: column name to JSON value. Shape is checked per table by the service. */
export const backupRowSchema = z.record(z.string(), z.unknown());

export const backupEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  tables: z.record(z.string(), z.array(backupRowSchema)),
});

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

export const backupMetadataSchema = z.object({
  exportedAt: z.string(),
  appVersion: z.string(),
  schemaVersion: z.number().int().positive(),
  exportFormat: z.enum(["json", "csv", "zip"]),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  attachmentTotalBytes: z.number().int().nonnegative(),
});

export type BackupMetadata = z.infer<typeof backupMetadataSchema>;

export const schemaVersionFileSchema = z.object({
  version: z.number().int().positive(),
});

export const manifestSchema = z.record(z.string(), z.string());
