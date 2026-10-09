import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { categories } from "./schema";

export interface DefaultCategory {
  name: string;
  slug: string;
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Work", slug: "work", color: "#4C6EF5", icon: "briefcase" },
  { name: "Study", slug: "study", color: "#7C3AED", icon: "graduation-cap" },
  { name: "Personal", slug: "personal", color: "#0EA5E9", icon: "user" },
  { name: "Health", slug: "health", color: "#10B981", icon: "heart-pulse" },
  { name: "Exercise", slug: "exercise", color: "#F59E0B", icon: "dumbbell" },
  { name: "Project", slug: "project", color: "#EC4899", icon: "folder-kanban" },
  { name: "Other", slug: "other", color: "#94A3B8", icon: "circle-ellipsis" },
];

/**
 * Inserts default categories whose slug does not already exist.
 * Idempotent: safe to run on every boot.
 */
export function seedDefaultCategories(db: Db, now: () => string = () => new Date().toISOString()): number {
  let inserted = 0;
  db.transaction((tx) => {
    DEFAULT_CATEGORIES.forEach((category, index) => {
      const existing = tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, category.slug))
        .get();
      if (existing) {
        return;
      }
      tx.insert(categories)
        .values({
          id: `default-${category.slug}`,
          name: category.name,
          slug: category.slug,
          color: category.color,
          icon: category.icon,
          sortOrder: index,
          isDefault: true,
          createdAt: now(),
        })
        .run();
      inserted += 1;
    });
  });
  return inserted;
}
