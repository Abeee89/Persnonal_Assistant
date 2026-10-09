import { describe, expect, it } from "vitest";
import { reconcileGoalStatus } from "./goal-status";

describe("reconcileGoalStatus", () => {
  it("moves a not-started auto goal to in_progress on first progress", () => {
    expect(reconcileGoalStatus({ status: "not_started", progressMode: "auto", progress: 20 })).toBe("in_progress");
  });

  it("stays not_started while there is no progress", () => {
    expect(reconcileGoalStatus({ status: "not_started", progressMode: "auto", progress: 0 })).toBe("not_started");
  });

  it("completes an auto goal at 100 percent", () => {
    expect(reconcileGoalStatus({ status: "in_progress", progressMode: "auto", progress: 100 })).toBe("completed");
  });

  it("reopens a completed auto goal that dropped below 100", () => {
    expect(reconcileGoalStatus({ status: "completed", progressMode: "auto", progress: 80 })).toBe("in_progress");
  });

  it("never changes archived goals", () => {
    expect(reconcileGoalStatus({ status: "archived", progressMode: "auto", progress: 100 })).toBe("archived");
  });

  it("leaves manual-progress goals to the user", () => {
    expect(reconcileGoalStatus({ status: "not_started", progressMode: "manual", progress: 100 })).toBe("not_started");
    expect(reconcileGoalStatus({ status: "completed", progressMode: "manual", progress: 30 })).toBe("completed");
  });
});
