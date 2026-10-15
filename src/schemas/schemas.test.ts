import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { defineAction } from "@/lib/action";
import { activityInputSchema, activityListQuerySchema } from "./activity";
import { sanitizeLine, sanitizeText, slugify, tagList } from "./common";
import { goalInputSchema } from "./goal";
import { habitInputSchema, habitLogToggleSchema } from "./habit";
import { journalUpsertSchema, MAX_JOURNAL_DOC_BYTES } from "./journal";
import { preferenceSetSchema, preferenceSchemaFor } from "./preference";
import { searchQuerySchema } from "./search";
import { taskInputSchema } from "./task";

const silentLog = { warn: vi.fn(), error: vi.fn() };
const validActivity = { title: "Coding", date: "2026-10-02" };

describe("sanitization", () => {
  it("collapses whitespace and strips control characters in single lines", () => {
    expect(sanitizeLine("  Deep \u0007 work\t\tblock  ")).toBe("Deep work block");
  });

  it("keeps line breaks in multi-line text but normalises CRLF", () => {
    expect(sanitizeText("a\r\nb\u0000\r\n")).toBe("a\nb");
  });

  it("slugifies accents and symbols", () => {
    expect(slugify("Café & Study!")).toBe("cafe-study");
  });

  it("normalises tags to lowercase and removes duplicates", () => {
    expect(tagList.parse(["Deepwork", "deepwork", " Client-X "])).toEqual(["deepwork", "client-x"]);
  });

  it("rejects tags longer than 24 characters", () => {
    expect(() => tagList.parse(["a".repeat(25)])).toThrow();
  });
});

describe("activityInputSchema", () => {
  it("accepts a minimal activity and applies defaults", () => {
    const parsed = activityInputSchema.parse(validActivity);
    expect(parsed).toMatchObject({
      title: "Coding",
      status: "planned",
      priority: "medium",
      startTime: null,
      endTime: null,
      mood: null,
      tags: [],
    });
  });

  it("rejects end time not after start time", () => {
    const result = activityInputSchema.safeParse({ ...validActivity, startTime: "10:00", endTime: "09:00" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endTime"]);
    }
  });

  it("requires a start time when only end time is given", () => {
    const result = activityInputSchema.safeParse({ ...validActivity, endTime: "10:00" });
    expect(result.success).toBe(false);
  });

  it("accepts a full-day activity without times", () => {
    expect(activityInputSchema.safeParse({ ...validActivity, allDay: true }).success).toBe(true);
  });

  it("rejects an impossible date and out-of-range mood", () => {
    expect(activityInputSchema.safeParse({ ...validActivity, date: "2026-02-30" }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...validActivity, mood: 6 }).success).toBe(false);
  });

  it("rejects an empty title after sanitization", () => {
    expect(activityInputSchema.safeParse({ ...validActivity, title: "   \u0001  " }).success).toBe(false);
  });

  it("parses list query defaults", () => {
    const query = activityListQuerySchema.parse({});
    expect(query).toMatchObject({ sort: "date_desc", limit: 50, status: null, from: null });
  });
});

describe("taskInputSchema", () => {
  it("defaults to todo/medium and nulls optional links", () => {
    expect(taskInputSchema.parse({ title: "Fix bug" })).toMatchObject({
      status: "todo",
      priority: "medium",
      dueDate: null,
      goalId: null,
    });
  });
});

describe("goalInputSchema", () => {
  it("rejects a deadline before the start date", () => {
    const result = goalInputSchema.safeParse({ title: "Learn", startDate: "2026-10-01", deadline: "2026-09-01" });
    expect(result.success).toBe(false);
  });

  it("requires a manual value when manual mode is chosen", () => {
    const result = goalInputSchema.safeParse({ title: "Learn", progressMode: "manual" });
    expect(result.success).toBe(false);
  });

  it("accepts manual mode with a value", () => {
    expect(
      goalInputSchema.safeParse({ title: "Learn", progressMode: "manual", manualProgress: 65 }).success,
    ).toBe(true);
  });
});

describe("habitInputSchema", () => {
  it("rejects a daily habit with a weekly target", () => {
    expect(habitInputSchema.safeParse({ name: "Read", frequency: "daily", targetPerPeriod: 3 }).success).toBe(false);
  });

  it("accepts weekly 3x target", () => {
    expect(habitInputSchema.safeParse({ name: "Gym", frequency: "weekly", targetPerPeriod: 3 }).success).toBe(true);
  });

  it("rejects a non-hex colour", () => {
    expect(habitInputSchema.safeParse({ name: "Read", color: "red" }).success).toBe(false);
  });

  it("validates the habit log toggle date", () => {
    expect(habitLogToggleSchema.safeParse({ habitId: "h1", date: "2026-10-02" }).success).toBe(true);
    expect(habitLogToggleSchema.safeParse({ habitId: "h1", date: "10/02/2026" }).success).toBe(false);
  });
});

describe("journalUpsertSchema", () => {
  it("accepts a TipTap-shaped JSON object", () => {
    const doc = JSON.stringify({ type: "doc", content: [] });
    expect(journalUpsertSchema.safeParse({ date: "2026-10-02", contentJson: doc }).success).toBe(true);
  });

  it("rejects non-object JSON and invalid JSON", () => {
    expect(journalUpsertSchema.safeParse({ date: "2026-10-02", contentJson: "[1,2]" }).success).toBe(false);
    expect(journalUpsertSchema.safeParse({ date: "2026-10-02", contentJson: "{oops" }).success).toBe(false);
  });

  it("caps the document size at 1 MB", () => {
    const big = JSON.stringify({ text: "x".repeat(MAX_JOURNAL_DOC_BYTES) });
    expect(journalUpsertSchema.safeParse({ date: "2026-10-02", contentJson: big }).success).toBe(false);
  });

  it("keeps multi-line answers intact", () => {
    const parsed = journalUpsertSchema.parse({ date: "2026-10-02", learned: "one\r\ntwo" });
    expect(parsed.learned).toBe("one\ntwo");
  });
});

describe("preferences whitelist", () => {
  it("resolves only known keys", () => {
    expect(preferenceSchemaFor("density")).not.toBeNull();
    expect(preferenceSchemaFor("theme")).toBeNull();
    expect(preferenceSchemaFor("__proto__")).toBeNull();
    expect(preferenceSchemaFor("admin")).toBeNull();
  });

  it("validates values per key", () => {
    expect(preferenceSetSchema.safeParse({ key: "density", value: "compact" }).success).toBe(true);
    expect(preferenceSetSchema.safeParse({ key: "density", value: "huge" }).success).toBe(false);
    expect(preferenceSetSchema.safeParse({ key: "shortcutsEnabled", value: false }).success).toBe(true);
    expect(preferenceSetSchema.safeParse({ key: "hacker", value: 1 }).success).toBe(false);
  });
});

describe("searchQuerySchema", () => {
  it("requires a non-empty query and caps limit", () => {
    expect(searchQuerySchema.safeParse({ q: "   " }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "Next.js", limit: 500 }).success).toBe(false);
    expect(searchQuerySchema.parse({ q: "Next.js" }).limit).toBe(10);
  });
});

describe("defineAction guard seam", () => {
  it("returns FORBIDDEN and skips the handler when the guard rejects", async () => {
    const handler = vi.fn(() => "ran");
    const action = defineAction(
      "t",
      activityInputSchema,
      handler,
      {
        logger: silentLog,
        requestId: () => "g1",
        guard: () => {
          throw new AppError("FORBIDDEN", "Sign in required.");
        },
      },
    );
    const result = await action(validActivity);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "Sign in required.", requestId: "g1" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the guard before validation", async () => {
    const order: string[] = [];
    const action = defineAction(
      "t",
      activityInputSchema,
      () => {
        order.push("handler");
        return "ok";
      },
      {
        logger: silentLog,
        guard: () => {
          order.push("guard");
        },
      },
    );
    await action({ title: "" });
    expect(order).toEqual(["guard"]);
  });
});
