import { test, expect } from "../../fixtures/base-fixtures";

test.describe("Messaging Table", () => {
  test("loads messaging page", async ({ authenticatedPage: page }) => {
    await page.goto("/messaging");

    // Should show the messaging page (with table or empty state)
    await expect(
      page.getByRole("heading", { name: /no messages yet/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("create message button is visible", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/messaging");

    await expect(
      page.getByRole("button", { name: /create message/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
