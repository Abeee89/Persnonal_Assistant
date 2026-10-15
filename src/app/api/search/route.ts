import { NextResponse } from "next/server";
import { getDb } from "@/db/runtime";
import { errorResponse } from "@/lib/http";
import { searchQuerySchema } from "@/schemas/search";
import { search, SEARCH_KINDS, type SearchKind } from "@/features/search/service";
import { toFieldErrors } from "@/lib/action";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/search?q=&types=activity,task&limit= — read-only, for the command palette. */
export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = searchQuerySchema.safeParse({
      q: url.searchParams.get("q") ?? "",
      types: (url.searchParams.get("types") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t !== ""),
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Please fix the highlighted fields.", {
        fieldErrors: toFieldErrors(parsed.error),
      });
    }
    const kinds = parsed.data.types.filter((t): t is SearchKind => (SEARCH_KINDS as readonly string[]).includes(t));
    const hits = search(getDb(), parsed.data.q, {
      kinds: kinds.length > 0 ? kinds : undefined,
      limitPerKind: parsed.data.limit,
    });
    return NextResponse.json({ ok: true, data: hits });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
