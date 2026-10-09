import { NextResponse } from "next/server";
import { assertSameOrigin, errorResponse } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { attachmentUploadMetaSchema } from "@/schemas/attachment";
import { toFieldErrors } from "@/lib/action";
import { attachmentContext } from "@/features/attachments/runtime";
import { uploadAttachment } from "@/features/attachments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data: `file`, `entityType`, optional `entityId`.
 * Size is checked again inside the service against the configured cap.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION", "Choose a file to upload.", { fieldErrors: { file: ["Choose a file to upload."] } });
    }
    const meta = attachmentUploadMetaSchema.safeParse({
      entityType: form.get("entityType"),
      entityId: form.get("entityId") ?? undefined,
    });
    if (!meta.success) {
      throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
        fieldErrors: toFieldErrors(meta.error),
      });
    }
    const ctx = attachmentContext();
    if (file.size > ctx.maxBytes) {
      throw new AppError("FILE_TOO_LARGE", "This file is larger than the upload limit.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = await uploadAttachment(
      ctx.db,
      {
        entityType: meta.data.entityType,
        entityId: meta.data.entityId,
        originalName: file.name,
        bytes,
      },
      ctx,
    );
    return NextResponse.json({ ok: true, data: view }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
