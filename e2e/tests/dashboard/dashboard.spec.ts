import { test, expect } from "../../fixtures/base-fixtures";

test.describe("Dashboard", () => {
  test("loads and displays metric cards", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    // Wait for metrics to load
    await expect(page.getByText(/link views/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: /link views/i })
    ).toContainText("150");
  });

  test("date range picker is visible", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    // The date range picker should be present
    // The trigger renders the selected range, e.g. "Jul 15, 2026 - Aug 14, 2026"
    await expect(
      page.getByRole("button", {
        name: /\w{3} \d{1,2}, \d{4} - \w{3} \d{1,2}, \d{4}/,
      })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("top performing links section loads", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/top links/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
