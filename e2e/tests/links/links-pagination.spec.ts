import { test, expect } from "../../fixtures/base-fixtures";
import { TEST_LINK, TEST_PROJECT } from "../../fixtures/test-data";

const ALL_LINKS = Array.from({ length: 60 }, (_, i) => ({
  ...TEST_LINK,
  id: `link-${i + 1}`,
  name: `Link ${String(i + 1).padStart(3, "0")}`,
  path: `link-${i + 1}`,
  url: `https://test.grovs.io/link-${i + 1}`,
}));

test.describe("Links pagination", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/links/search_v2`,
      async (route) => {
        const body = route.request().postDataJSON() ?? {};
        const perPage = body.per_page ?? 25;
        const pageNum = body.page ?? 1;
        const start = (pageNum - 1) * perPage;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            links: ALL_LINKS.slice(start, start + perPage),
            meta: {
              total_pages: Math.ceil(ALL_LINKS.length / perPage),
              total_entries: ALL_LINKS.length,
            },
          }),
        });
      }
    );
  });

  test("next page button loads page 2", async ({ authenticatedPage: page }) => {
    await page.goto("/dynamic_links/links");

    await expect(page.getByText("Link 001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Page 1 of 3")).toBeVisible();

    await page.getByLabel("Go to next page").click();

    await expect(page.getByText("Page 2 of 3")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText("Link 026")).toBeVisible();
  });

  test("changing rows per page to 50 reloads the table with 50 rows", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dynamic_links/links");

    await expect(page.getByText("Link 001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Page 1 of 3")).toBeVisible();

    await page.getByRole("combobox").filter({ hasText: "25" }).click();
    await page.getByRole("option", { name: "50" }).click();

    // 60 links / 50 per page = 2 pages
    await expect(page.getByText("Page 1 of 2")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText("Link 050")).toBeVisible();
    await expect(page).toHaveURL(/perPage=50/);
  });
});
