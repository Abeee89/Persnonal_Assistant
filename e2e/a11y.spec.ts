import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility smoke pass (SDD §36). Serious and critical axe findings fail the build;
 * moderate/minor findings are reported in the HTML report so they can be triaged.
 */
const PAGES = [
  ["/", "dashboard"],
  ["/activities", "activities list"],
  ["/tasks", "tasks"],
  ["/goals", "goals"],
  ["/habits", "habits"],
  ["/calendar", "calendar"],
  ["/statistics", "statistics"],
  ["/settings", "settings"],
  ["/settings/backup", "backup"],
] as const;

for (const [path, name] of PAGES) {
  test(`no serious accessibility issues on ${name}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    const summary = serious.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} — ${node.failureSummary ?? ""}`),
    );
    expect(summary, `axe violations on ${path}`).toEqual([]);
  });
}