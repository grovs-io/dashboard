import { test, expect } from "../../fixtures/base-fixtures";

test.describe("Sidebar Navigation", () => {
  test("sidebar shows navigation items", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    const nav = page.getByLabel("Main navigation");
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible({
      timeout: 10_000,
    });
    for (const section of ["Analytics", "Links", "Audience", "Settings"]) {
      await expect(
        nav.getByRole("button", { name: section, exact: true })
      ).toBeVisible();
    }
  });

  test("navigates to links page", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    // Sections start collapsed: open LINKS, then "Dynamic Links" is a link under it.
    const nav = page.getByLabel("Main navigation");
    await nav.getByRole("button", { name: "Links", exact: true }).click();
    const linksNav = nav.getByRole("link", { name: "Dynamic Links" });
    await expect(linksNav).toBeVisible({ timeout: 10_000 });
    await linksNav.click();

    await page.waitForURL("**/dynamic_links/links**", { timeout: 10_000 });
  });

  test("navigates to settings page", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");

    const nav = page.getByLabel("Main navigation");
    await nav.getByRole("button", { name: "Settings", exact: true }).click();
    const teamNav = nav.getByRole("link", { name: "Team" });
    await expect(teamNav).toBeVisible({ timeout: 10_000 });
    await teamNav.click();

    await page.waitForURL("**/settings/team**", { timeout: 10_000 });
  });

  test("project switcher shows project name", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/test project/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
