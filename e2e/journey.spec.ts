import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end journey against the production build. Tests run serially and share one
 * database, which is intentional: this is one user's first afternoon with the app.
 */
test.describe.serial("personal activity journey", () => {
  const today = new Date().toISOString().slice(0, 10);

  test("a fresh install starts calm and greets the user", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    await expect(page.getByText("A quiet start")).toBeVisible();
    const glance = page.getByRole("region", { name: "Today at a glance" });
    await expect(glance.getByText("Activities", { exact: true })).toBeVisible();
  });

  test("logging an activity saves it and paints the dashboard", async ({ page }) => {
    await page.goto("/activities/new");
    await page.getByLabel("Title").fill("Build Next.js dashboard");
    await page.getByLabel("Category").selectOption({ label: "Work" });
    await page.getByLabel("Start").fill("09:00");
    await page.getByLabel("End").fill("10:30");
    await page.getByRole("button", { name: "Add activity" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build Next.js dashboard");
    await expect(page.getByText("09:00–10:30")).toBeVisible();

    await page.goto("/activities");
    await expect(page.getByRole("link", { name: "Build Next.js dashboard" })).toBeVisible();
  });

  test("journal autosaves and survives a reload", async ({ page }) => {
    await page.goto(`/journal/${today}`);
    await expect(page.getByRole("heading", { name: "Journal" })).toBeVisible();

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.pressSequentially("Shipped the backup feature today.");

    await expect(page.getByRole("status")).toHaveText(/^Saved$/);

    await page.reload();
    await expect(page.locator(".ProseMirror")).toContainText("Shipped the backup feature today.");
  });

  test("tasks are added in a lane and can be completed", async ({ page }) => {
    await page.goto("/tasks");
    await page.getByLabel("New task").fill("Review the roadmap");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Someday/ })).toBeVisible();

    await page.getByRole("checkbox", { name: /Mark "Review the roadmap" done/ }).click();
    await expect(page.getByRole("heading", { name: /^Done/ })).toBeVisible();
  });

  test("a goal's progress follows its milestones", async ({ page }) => {
    await page.goto("/goals/new");
    await page.locator('input[name="title"]').fill("Learn Next.js");
    await page.locator('input[name="startDate"]').fill(today);
    await page.locator('input[name="deadline"]').fill("2026-12-31");
    await page.getByRole("button", { name: "Create goal" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Learn Next.js");
    await page.getByLabel("New milestone").fill("App Router");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("checkbox", { name: /Mark "App Router" done/ }).click();

    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  test("a habit can be checked and shows a streak", async ({ page }) => {
    await page.goto("/habits/new");
    await page.locator('input[name="name"]').fill("Read");
    await page.getByRole("button", { name: "Create habit" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Read");
    await page.getByRole("checkbox", { name: /today: not done/ }).click();
    await expect(page.getByRole("checkbox", { name: /today: done/ })).toBeVisible();
    await expect(page.getByText("Current streak")).toBeVisible();
  });

  test("search finds what was written", async ({ page }) => {
    await page.goto("/search?q=dashboard");
    await expect(page.getByRole("link", { name: /Build Next\.js dashboard/ }).first()).toBeVisible();

    await page.goto("/search?q=backup+feature");
    await expect(page.getByText(/Journal/).first()).toBeVisible();
  });

  test("the command palette opens with Ctrl+K and finds an activity", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: "Search and quick actions" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Search or jump to" }).fill("roadmap");
    await expect(dialog.getByText("Review the roadmap").first()).toBeVisible();
  });

  test("dark mode sticks across a reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("statistics and backup pages respond", async ({ page }) => {
    await page.goto("/statistics");
    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
    await expect(page.getByText("Productivity score")).toBeVisible();

    await page.goto("/settings/backup");
    await expect(page.getByRole("link", { name: "Download ZIP" })).toBeVisible();

    const response = await page.request.get("/api/export?format=json");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { schemaVersion: number; tables: Record<string, unknown[]> };
    expect(body.schemaVersion).toBe(1);
    expect(body.tables["activities"]?.length).toBeGreaterThan(0);
  });

  test("mobile layout shows the bottom navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary mobile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quick add" })).toBeVisible();
  });
});

test("works with JavaScript disabled for the list pages", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page: Page = await context.newPage();
  await page.goto("/activities");
  await expect(page.getByRole("heading", { name: "Activities" })).toBeVisible();
  await context.close();
});