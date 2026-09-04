import { test, expect } from "../../fixtures/base-fixtures";

test.describe("Create Link", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock random path
    await page.route(
      "**/api/v1/projects/*/links/random_path",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ valid_path: "random-path-123" }),
        });
      }
    );

    // Mock path availability
    await page.route(
      "**/api/v1/projects/*/links/path_available*",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ available: true }),
        });
      }
    );

    // Mock link creation
    await page.route("**/api/v1/projects/*/links", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            link: {
              id: "new-link-001",
              name: "New Test Link",
              path: "random-path-123",
              url: "https://test.grovs.io/random-path-123",
            },
          }),
        });
      }
    });

    await page.goto("/dynamic_links/links");
  });

  test("fill details and create link", async ({ authenticatedPage: page }) => {
    // Open create dialog
    const createButton = page
      .getByRole("button", { name: /create.*link|new.*link/i })
      .first();
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();

    // Fill in link name (the dialog's name field, not the tag input)
    const nameInput = page.locator("#link-name");
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("My Test Link");

    // The path auto-populates from the random_path endpoint
    await expect(page.locator("#link-path")).toHaveValue(/.+/, {
      timeout: 5000,
    });
  });
});
