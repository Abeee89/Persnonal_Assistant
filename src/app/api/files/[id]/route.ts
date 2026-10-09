import { NextResponse } from "next/server";
import { getDb } from "@/db/runtime";
import { findReadable } from "@/features/attachments/service";
import { getStorage } from "@/features/attachments/runtime";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/http";
import { isSafeStorageKey } from "@/lib/files/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-zA-Z-]{1,64}$/;

/**
 * Streams a stored file. Content type comes from the sniffed value in the DB,
 * never from the client. Served with nosniff and a locked-down CSP so a file
 * cannot run script even if opened directly (SDD §08 §4).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!ID_PATTERN.test(id)) {
      throw new AppError("NOT_FOUND", "File not found.");
    }
    const row = findReadable(getDb(), id);
    if (!row || !isSafeStorageKey(row.storagePath)) {
      throw new AppError("NOT_FOUND", "File not found.");
    }
    const bytes = await getStorage().get(row.storagePath);
    if (!bytes) {
      throw new AppError("NOT_FOUND", "File not found.");
    }
    const url = new URL(request.url);
    const download = url.searchParams.get("dl") === "1";
    const safeName = row.originalName.replace(/["\\\r\n]/g, "_");
    const disposition = download ? "attachment" : "inline";
    return new NextResponse(new Blob([new Uint8Array(bytes)], { type: row.mimeType }), {
      status: 200,
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${disposition}; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
