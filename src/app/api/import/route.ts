import { NextResponse } from "next/server";
import { parseEnv } from "@/config/env";
import { getDb } from "@/db/runtime";
import { getStorage } from "@/features/attachments/runtime";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { assertSameOrigin } from "@/lib/http";
import { applyImport, createAutoBackup, parseArchive, previewImport, rawClient } from "@/features/backup/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard cap on an uploaded archive, so a huge upload cannot exhaust memory. */
const MAX_IMPORT_BYTES = 512 * 1024 * 1024;

/**
 * POST /api/import
 * `?preview=1` validates and reports what would change without writing anything.
 * Otherwise the archive is applied: attachments first, then one database transaction.
 * The client is expected to send `strategy` = merge or replace.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const url = new URL(request.url);
    const previewOnly = url.searchParams.get("preview") === "1";

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION", "Choose a backup file.", { fieldErrors: { file: ["Choose a backup file."] } });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      throw new AppError("FILE_TOO_LARGE", "That backup is larger than the 512 MB import limit.");
    }
    const strategyValue = form.get("strategy");
    const strategy = strategyValue === "merge" ? "merge" : "replace";

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseArchive(bytes);
    const client = rawClient(getDb());

    if (previewOnly) {
      return NextResponse.json({ ok: true, data: { preview: previewImport(client, parsed) } });
    }

    const env = parseEnv(process.env);
    const safetyCopy = createAutoBackup(client, env.DATA_DIR, new Date().toISOString());
    const report = await applyImport(client, getStorage(), parsed, strategy);
    return NextResponse.json({ ok: true, data: { report, safetyCopy } });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
