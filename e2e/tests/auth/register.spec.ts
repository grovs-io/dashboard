import { test, expect } from "@playwright/test";
import { setupApiMocks } from "../../fixtures/api-mocks";

test.describe("Register", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);

    // Mock registration endpoint
    await page.route("**/api/v1/users", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ user: { id: "new-user-001" } }),
        });
      }
    });
  });

  test("shows register type selection page", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("button", { name: /register with email and password/i })
    ).toBeVisible();
  });

  test("email registration form has required fields", async ({ page }) => {
    await page.goto("/register/with_email");
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page
        .getByLabel(/^password$/i)
        .or(page.getByPlaceholder(/password/i).first())
    ).toBeVisible();
  });

  test("register button is disabled without valid input", async ({ page }) => {
    await page.goto("/register/with_email");
    const registerButton = page.getByRole("button", {
      name: /get started/i,
    });
    await expect(registerButton).toBeDisabled();
  });

  test("password rules gate the submit button", async ({ page }) => {
    await page.goto("/register/with_email");

    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill("test@example.com");

    const submit = page.getByRole("button", { name: /get started/i });

    // 8 chars satisfies the zod schema but not the strength rules
    await page.locator("#password").fill("password");
    await page.locator("#password_confirm").fill("password");
    await expect(submit).toBeDisabled();

    await page.locator("#password").fill("Password1!");
    await page.locator("#password_confirm").fill("Password1!");
    await expect(submit).toBeEnabled();
  });
});
