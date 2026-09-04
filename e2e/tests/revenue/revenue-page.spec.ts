import { test, expect } from "../../fixtures/base-fixtures";

// Revenue is an enterprise feature; a Community Edition build has no revenue page.
test.describe("Revenue Page", () => {
  test.skip(
    process.env.NEXT_PUBLIC_GROVS_EE !== "true",
    "revenue page is enterprise-only"
  );

  test("loads revenue page", async ({ authenticatedPage: page }) => {
    await page.goto("/revenue");

    // Should show revenue page content
    await expect(page.getByText(/revenue/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
