import { describe, expect, it } from "vitest";
import { isThemeMode, resolveTheme, themeInitScript } from "./theme";

describe("theme", () => {
  it("validates theme modes", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("neon")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  it("resolves system mode from OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("ignores OS preference for explicit modes", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("init script is self-contained and uses the storage key", () => {
    expect(themeInitScript).toContain("pa-theme");
    expect(themeInitScript).toContain("classList.toggle");
  });
});
