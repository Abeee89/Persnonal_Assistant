import { describe, expect, it } from "vitest";
import { greetingFor, pickFocusCard } from "./focus";

describe("pickFocusCard", () => {
  it("shows overdue work first", () => {
    expect(pickFocusCard({ overdueCount: 2, hasTodayJournal: false, hasActiveGoal: true })).toBe("overdue");
  });

  it("asks for the daily reflection when today has no entry", () => {
    expect(pickFocusCard({ overdueCount: 0, hasTodayJournal: false, hasActiveGoal: true })).toBe("reflection");
  });

  it("shows a goal once the reflection is written", () => {
    expect(pickFocusCard({ overdueCount: 0, hasTodayJournal: true, hasActiveGoal: true })).toBe("goal");
  });

  it("shows nothing when there is nothing to push", () => {
    expect(pickFocusCard({ overdueCount: 0, hasTodayJournal: true, hasActiveGoal: false })).toBe("none");
  });
});

describe("greetingFor", () => {
  it("uses the time of day", () => {
    expect(greetingFor(0)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good afternoon");
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
  });
});
