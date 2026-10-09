import { describe, expect, it } from "vitest";
import { MOBILE_NAV, PRIMARY_NAV, isActivePath } from "./nav";

describe("isActivePath", () => {
  it("only matches root exactly for dashboard", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/today", "/")).toBe(false);
  });

  it("matches nested routes for section links", () => {
    expect(isActivePath("/activities/abc", "/activities")).toBe(true);
    expect(isActivePath("/activitiesX", "/activities")).toBe(false);
  });
});

describe("navigation config", () => {
  it("matches the SDD desktop IA (9 primary items)", () => {
    expect(PRIMARY_NAV.map((item) => item.href)).toEqual([
      "/",
      "/today",
      "/calendar",
      "/activities",
      "/journal",
      "/tasks",
      "/goals",
      "/habits",
      "/statistics",
    ]);
  });

  it("mobile bottom nav has 4 slots plus the FAB reserved in the shell", () => {
    expect(MOBILE_NAV).toHaveLength(4);
  });
});
