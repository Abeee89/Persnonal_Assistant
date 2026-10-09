import { getDb } from "@/db/runtime";
import { activityListQuerySchema, type ActivityListQuery } from "@/schemas/activity";
import { getActivity, findActivity, listActivities, listCategories, type ActivityPage, type ActivityView } from "./service";

/** Read path for RSC pages. Input is parsed here so URL params can be passed raw. */
export function loadActivityPage(raw: Record<string, string | string[] | undefined>): ActivityPage & {
  query: ActivityListQuery;
} {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = activityListQuerySchema.safeParse({
    ...flat,
    limit: flat.limit ? Number(flat.limit) : undefined,
  });
  const query = parsed.success ? parsed.data : activityListQuerySchema.parse({});
  return { ...listActivities(getDb(), query), query };
}

export function loadActivity(id: string): ActivityView | null {
  return findActivity(getDb(), id);
}

export function requireActivity(id: string): ActivityView {
  return getActivity(getDb(), id);
}

export function loadCategories(): { id: string; name: string; color: string | null }[] {
  return listCategories(getDb());
}
