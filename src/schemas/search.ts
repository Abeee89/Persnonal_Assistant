import { z } from "zod";
import { line } from "./common";

export const SEARCH_TYPES = ["activity", "journal", "task", "goal", "habit", "tag", "attachment"] as const;

export const searchQuerySchema = z.object({
  q: line(200, "Search"),
  types: z.array(z.enum(SEARCH_TYPES)).max(SEARCH_TYPES.length).default([]),
  limit: z.number().int().min(1).max(50).default(10),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
