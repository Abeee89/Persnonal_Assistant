import { NextResponse } from "next/server";
import { getDb } from "@/db/runtime";
import { getStorage } from "@/features/attachments/runtime";
import { backupFileName } from "@/lib/domain/backup";
import { localIsoDay } from "@/lib/domain/dates";
import { errorResponse } from "@/lib/http";
import { rawClient, exportCsvZip, exportJson, exportZipArchive } from "@/features/backup/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  json: "application/json",
  zip: "application/zip",
};

/**
 * GET /api/export?format=json|csv|zip
 * Streams a full backup. JSON is the canonical dump; ZIP adds attachments and a manifest.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "zip";
    if (!["json", "csv", "zip"].includes(format)) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION", message: "Choose json, csv or zip.", requestId: "export" } },
        { status: 422 },
      );
    }
    const client = rawClient(getDb());
    const day = localIsoDay();

    let body: Uint8Array | string;
    if (format === "json") {
      body = exportJson(client);
    } else if (format === "csv") {
      body = exportCsvZip(client);
    } else {
      body = await exportZipArchive(client, getStorage(), new Date().toISOString());
    }

    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return new NextResponse(new Blob([new Uint8Array(bytes)], { type: CONTENT_TYPE[format] ?? "application/octet-stream" }), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPE[format] ?? "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${backupFileName(format === "json" ? "json" : format === "csv" ? "csv.zip" : "zip", day)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
