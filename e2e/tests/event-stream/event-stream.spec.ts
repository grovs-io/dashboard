import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/base-fixtures";
import {
  TEST_INSTANCE,
  TEST_PROJECT,
  TEST_SUBSCRIPTION,
  TEST_USER,
} from "../../fixtures/test-data";
import { destination } from "../../../ee/components/event-stream/__tests__/fixtures";
import type { DestinationInput } from "../../../ee/types/eventStream";

async function streamMocks(page: Page, member = false) {
  let destinations = [
    destination({
      name: "Production warehouse",
      status: "paused",
      paused_reason: "manual",
    }),
    destination({
      id: "d2",
      name: "Backup bucket",
      kind: "s3",
      settings: { bucket: "backup", region: "us-east-1" },
    }),
  ];
  let feedTokens = [
    {
      id: "t-existing",
      name: "Warehouse reader",
      created_by_email: "test@example.com",
      created_at: "2026-09-16T10:00:00Z",
      last_used_at: null,
    },
  ];
  const writes: { path: string; method: string; body: unknown }[] = [];
  const tokenReads: string[] = [];
  await page.route("**/billing/subscription", (route) =>
    route.fulfill({ json: { ...TEST_SUBSCRIPTION, type: "enterprise" } })
  );
  if (member) {
    const user = {
      ...TEST_USER,
      roles: [{ instance_id: TEST_INSTANCE.id, role: "member" }],
      otp_required_for_login: false,
    };
    await page.addInitScript(
      (user) => localStorage.setItem("current_user", JSON.stringify(user)),
      user
    );
    await page.route("**/api/v1/me", (route) =>
      route.fulfill({ json: { user } })
    );
    await page.route("**/api/v1/users/me", (route) =>
      route.fulfill({ json: { user } })
    );
  }
  await page.route(/\/api\/v1\/projects\/[^/]+\/event/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method !== "GET")
      writes.push({ path, method, body: request.postDataJSON() });
    if (path.endsWith("/event_destinations")) {
      if (method === "GET")
        return route.fulfill({
          json: {
            event_destinations: path.includes(TEST_PROJECT.id)
              ? destinations
              : [],
          },
        });
      const input: DestinationInput = request.postDataJSON();
      const created = destination({ ...input, id: "new-connection" });
      destinations = [...destinations, created];
      return route.fulfill({
        status: 201,
        json: {
          event_destination: created,
          signing_secret:
            input.kind === "webhook" ? "whsec_browser_fixture" : null,
        },
      });
    }
    if (method === "PATCH" && path.includes("/event_destinations/")) {
      const updated = destinations.find((d) => path.endsWith(`/${d.id}`));
      if (!updated)
        return route.fulfill({ status: 404, json: { error: "Not found" } });
      Object.assign(updated, request.postDataJSON());
      return route.fulfill({ json: { event_destination: updated } });
    }
    if (path.endsWith("/event_stream_tokens")) {
      if (method === "GET") {
        tokenReads.push(path);
        return route.fulfill({ json: { event_stream_tokens: feedTokens } });
      }
      return route.fulfill({
        status: 201,
        json: {
          token: "est_browser_fixture",
          event_stream_token: { id: "t1", name: "Polling job" },
        },
      });
    }
    if (path.endsWith("/event_exports"))
      return route.fulfill({ status: 202, json: { message: "Queued" } });
    if (method === "DELETE" && path.includes("/event_stream_tokens/")) {
      feedTokens = feedTokens.filter((token) => !path.endsWith(`/${token.id}`));
      return route.fulfill({ json: { message: "Token revoked" } });
    }
    if (method === "DELETE") {
      destinations = destinations.filter((d) => !path.endsWith(`/${d.id}`));
      return route.fulfill({ json: { message: "Deleted" } });
    }
    return route.fulfill({ json: { message: "Test event delivered" } });
  });
  return { writes, tokenReads };
}

test.describe("Event Stream", () => {
  test("Enterprise access follows the enable screen layout and refreshes after an upgrade", async ({
    authenticatedPage: page,
  }) => {
    await streamMocks(page);
    let enterprise = false;
    await page.route("**/billing/subscription", (route) =>
      route.fulfill({
        json: { ...TEST_SUBSCRIPTION, type: enterprise ? "enterprise" : "pro" },
      })
    );
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/settings/developers/event_stream");
    const access = page.getByRole("region", { name: "Event Stream access" });
    await expect(
      access.getByRole("heading", { name: "Data Export", exact: true })
    ).toBeVisible();
    await expect(
      access.getByRole("link", { name: "Contact sales", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toHaveCount(0);
    await expect(access.getByText("Already on Enterprise?")).toHaveCount(0);
    await expect(access.getByText("What you get")).toHaveCount(0);
    await expect(access.getByRole("heading", { level: 2 })).toHaveCount(4);
    await page.screenshot({
      path: "test-results/event-stream-access-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      access.getByRole("button", { name: "Refresh access" })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      path: "test-results/event-stream-access-mobile.png",
      fullPage: true,
    });
    enterprise = true;
    await access.getByRole("button", { name: "Refresh access" }).click();
    await expect(
      page.getByRole("button", { name: "Add destination", exact: true })
    ).toBeVisible();
    await expect(access).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toBeVisible();
  });

  test("confirmation dismissal restores focus for exports and destination actions", async ({
    authenticatedPage: page,
  }) => {
    const { writes } = await streamMocks(page);
    await page.goto("/settings/developers/event_stream");
    await page.getByRole("tab", { name: "Exports", exact: true }).click();
    const start = page.getByRole("button", {
      name: "Start export",
      exact: true,
    });
    for (const dismissal of ["Cancel", "Escape", "Close"]) {
      await start.click();
      const confirmation = page.getByRole("dialog", { name: "Start export?" });
      await expect(confirmation).toBeVisible();
      if (dismissal === "Escape") await page.keyboard.press("Escape");
      else
        await confirmation
          .getByRole("button", { name: dismissal, exact: true })
          .click();
      await expect(confirmation).toHaveCount(0);
      await expect(start).toBeFocused();
    }
    await page.getByRole("tab", { name: "Destinations" }).click();
    await page
      .getByRole("button", { name: "Backup bucket", exact: true })
      .click();
    const actions = page.getByRole("button", { name: "Actions", exact: true });
    for (const action of ["Delete destination", "Replay events"]) {
      await actions.click();
      await page.getByRole("menuitem", { name: action, exact: true }).click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Backup bucket", exact: true })
      ).toBeVisible();
      await expect(actions).toBeFocused();
    }
    expect(writes).toHaveLength(0);
  });

  for (const action of ["test", "delete", "replay"] as const) {
    test(`keeps the ${action} error visible when another admin deletes the destination`, async ({
      authenticatedPage: page,
    }) => {
      await streamMocks(page);
      let deleted = false;
      await page.route(
        /\/event_destinations(?:\/d2(?:\/(?:test|rewind))?)?$/,
        async (route) => {
          if (route.request().method() !== "GET") {
            deleted = true;
            return route.fulfill({
              status: 404,
              json: { error: "Destination not found" },
            });
          }
          if (deleted)
            return route.fulfill({ json: { event_destinations: [] } });
          return route.fallback();
        }
      );
      await page.goto("/settings/developers/event_stream");
      await page
        .getByRole("button", { name: "Backup bucket", exact: true })
        .click();
      if (action === "test") {
        await page
          .getByRole("button", { name: "Send test event", exact: true })
          .click();
      } else {
        await page
          .getByRole("button", { name: "Actions", exact: true })
          .click();
        await page
          .getByRole("menuitem", {
            name: action === "delete" ? "Delete destination" : "Replay events",
            exact: true,
          })
          .click();
        if (action === "replay")
          await page
            .getByRole("button", { name: "Review replay", exact: true })
            .click();
        await page
          .getByRole("button", {
            name: action === "delete" ? "Delete destination" : "Confirm replay",
            exact: true,
          })
          .click();
      }
      const unavailable = page.getByRole("dialog", {
        name: "Destination unavailable",
      });
      await expect(unavailable).toBeVisible();
      await expect(unavailable.getByRole("alert")).toHaveText(
        "Destination not found"
      );
      await unavailable
        .getByRole("button", { name: "Back to destinations" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("No destinations yet")).toBeVisible();
      await expect(
        page.locator('[aria-label="Destinations"][tabindex="-1"]')
      ).toBeFocused();
      await expect(
        page.getByRole("alert").filter({ hasText: "Destination not found" })
      ).toHaveCount(0);
    });
  }

  test("admin adds and removes independent connections, saves a secret, and exports to a paused destination", async ({
    authenticatedPage: page,
  }) => {
    const { writes } = await streamMocks(page);
    await page.goto("/settings/developers/event_stream");
    await expect(
      page.getByRole("button", { name: "Production warehouse", exact: true })
    ).toBeVisible();
    await expect(
      page
        .getByLabel("Main navigation")
        .getByRole("link", { name: "Data Export", exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: "Add destination" }).click();
    await expect(page.getByLabel("Header 1 name")).toHaveCount(0);
    await page.getByRole("button", { name: "Add header", exact: true }).click();
    await expect(page.getByLabel("Header 1 name")).toBeVisible();
    await page
      .getByRole("button", { name: "Remove header 1", exact: true })
      .click();
    await expect(page.getByLabel("Header 1 name")).toHaveCount(0);
    await page.getByLabel("Name", { exact: true }).fill("CRM endpoint");
    await page.getByLabel("Webhook URL").fill("https://crm.example.com/events");
    await page.getByRole("button", { name: "Create and enable" }).click();
    await expect(
      page.getByRole("textbox", { name: "Signing secret", exact: true })
    ).toHaveValue("whsec_browser_fixture");
    await expect(
      page.getByRole("button", { name: "Done", exact: true })
    ).toBeEnabled();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByText("Copied to clipboard.")).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-signing-secret.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "CRM endpoint" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Send test event" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Test event delivered"
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit destination" })
    ).toBeVisible();
    await page
      .getByLabel("Webhook URL")
      .fill("https://crm.example.com/updated");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("dialog", { name: "CRM endpoint" })
    ).toBeVisible();
    await expect(
      page
        .getByRole("dialog")
        .getByText("https://crm.example.com/updated", { exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: "Actions" }).click();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-destination-actions.png",
      fullPage: true,
    });
    await page.getByRole("menuitem", { name: "Delete destination" }).click();
    await page
      .getByRole("button", { name: "Delete destination", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "CRM endpoint", exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Backup bucket", exact: true })
    ).toBeVisible();
    await page.getByRole("tab", { name: "Exports", exact: true }).click();
    await page.getByLabel("Send export to").click();
    await page
      .getByRole("option", { name: "Production warehouse (Webhook, paused)" })
      .click();
    await page.getByRole("button", { name: "Start export" }).click();
    await expect(page.getByText(/sends data despite the pause/)).toBeVisible();
    await page.getByRole("button", { name: "Confirm export" }).click();
    await expect(
      page.getByRole("heading", { name: "Export requested", exact: true })
    ).toBeVisible();
    expect(writes.filter((w) => w.path.endsWith("/resume"))).toHaveLength(0);
    expect(
      writes.filter((w) => w.path.endsWith("/event_exports"))
    ).toHaveLength(1);
    await page.getByRole("tab", { name: "Destinations" }).click();
    await page
      .getByRole("button", { name: "View Production warehouse details" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Production warehouse" })
    ).toBeVisible();
    await expect(
      page.getByText("Analytics bookmark", { exact: true })
    ).toHaveCount(0);
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-desktop.png",
      fullPage: true,
    });
  });
  test("destination controls retain multiple event selections and collapsed delivery settings", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { writes } = await streamMocks(page);
    await page.goto("/settings/developers/event_stream");
    await expect(
      page.getByRole("button", { name: "Add destination" })
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-sections.png",
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Pull feed tokens" }).click();
    await expect(
      page.getByRole("button", { name: "Create feed token" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add destination" })
    ).toHaveCount(0);
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-feed.png",
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Exports" }).click();
    await expect(page.getByLabel("Date range")).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-exports.png",
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Destinations" }).click();
    await page.getByRole("button", { name: "Add destination" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Selected events");
    await page.getByLabel("Webhook URL").fill("https://crm.example.com/events");
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-form-overview.png",
      fullPage: true,
    });
    await page.getByLabel("Event types", { exact: true }).click();
    const eventOptions = page.getByRole("region", {
      name: "Event type options",
    });
    await eventOptions.hover();
    await page.mouse.wheel(0, 500);
    await expect
      .poll(() => eventOptions.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await expect(
      page.getByRole("checkbox", { name: "Purchases" })
    ).toBeInViewport();

    await page.getByRole("checkbox", { name: /Screen views/ }).check();
    await page
      .getByRole("checkbox", { name: "Installs", exact: true })
      .uncheck();
    await page.getByLabel("Search event types").fill("purchase");
    await expect(
      page.getByRole("checkbox", { name: "Purchases" })
    ).toBeChecked();
    await page.getByLabel("Search event types").clear();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-event-types.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page
      .getByRole("switch", { name: "Include IP address and city" })
      .check();
    await page.getByRole("button", { name: /Advanced settings/ }).click();
    await page.getByLabel("Batch size").fill("1000000000");
    await page.getByLabel("Concurrency").fill("400");
    await expect(
      page.getByText("Enter a whole number between 1 and 500.")
    ).toBeVisible();
    await expect(
      page.getByText("Enter a whole number between 1 and 16.")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create and enable" })
    ).toBeDisabled();
    expect(writes).toHaveLength(0);
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-number-validation.png",
      fullPage: true,
    });
    await page.getByLabel("Batch size").fill("250");
    await page.getByLabel("Concurrency").fill("8");
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-destination-form.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /Advanced settings/ }).click();
    await expect(page.getByLabel("Batch size")).not.toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Event types", { exact: true }).click();
    await eventOptions.hover();
    await page.mouse.wheel(0, 500);
    await expect
      .poll(() => eventOptions.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await expect(
      page.getByRole("checkbox", { name: "Purchases" })
    ).toBeInViewport();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-options-mobile.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");

    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-form-mobile.png",
      fullPage: true,
    });
    await expect(
      page.getByRole("button", { name: "Create and enable" })
    ).toBeInViewport();
    await page.getByRole("button", { name: "Create and enable" }).click();
    await expect(
      page.getByRole("textbox", { name: "Signing secret", exact: true })
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-secret-mobile.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Selected events" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send test event" })
    ).toBeInViewport();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-details-admin-mobile.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const create = writes.find((write) =>
      write.path.endsWith("/event_destinations")
    );
    expect(create?.body).toMatchObject({
      include_ip: true,
      batch_size: 250,
      concurrency: 8,
    });
    expect(create?.body).toHaveProperty(
      "event_types",
      expect.arrayContaining(["screen_view", "purchase"])
    );
    expect(create?.body).toHaveProperty(
      "event_types",
      expect.not.arrayContaining(["install"])
    );
  });
  test("the tab header stays the same height when switching sections", async ({
    authenticatedPage: page,
  }) => {
    await streamMocks(page);
    await page.goto("/settings/developers/event_stream");
    await expect(
      page.getByRole("button", { name: "Add destination" })
    ).toBeVisible();
    const header = page
      .getByRole("tablist", { name: "Event Stream navigation" })
      .locator("..");
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page
        .getByRole("tab", { name: "Destinations", exact: true })
        .click();
      const initial = await header.boundingBox();
      expect(initial).not.toBeNull();
      for (const name of ["Pull feed tokens", "Exports", "Destinations"]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await expect
          .poll(async () => (await header.boundingBox())?.height)
          .toBe(initial!.height);
      }
    }
  });
  test("exports show the selected range and delivery details on desktop and mobile", async ({
    authenticatedPage: page,
  }) => {
    await streamMocks(page);
    await page.goto("/settings/developers/event_stream");
    await page.getByRole("tab", { name: "Exports", exact: true }).click();
    await page.getByLabel("Date range").click();
    await page
      .getByRole("button", { name: "Last 30 days", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("grid")).toHaveCount(0);
    await expect(page.getByText(/30 days selected/)).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-exports-email.png",
      fullPage: true,
    });
    await page.getByLabel("Send export to").click();
    await page
      .getByRole("option", { name: "Production warehouse (Webhook, paused)" })
      .click();
    await expect(
      page.getByText(/even though live delivery is paused/)
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-exports-destination.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Date range").click();
    await expect(
      page.getByRole("button", { name: "Last 90 days", exact: true })
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-export-calendar-mobile.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("grid")).toHaveCount(0);
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-exports-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.getByRole("button", { name: "Start export" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Start export?",
    });
    await expect(
      dialog.getByText("Production warehouse", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-export-review.png",
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Confirm export", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Export requested" })
    ).toBeFocused();
    await expect(page.getByLabel("Date range")).toHaveCount(0);
    await expect(
      page.getByText("Production warehouse", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/event-stream-export-success-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Create another export" }).click();
    await expect(page.getByLabel("Date range")).toBeFocused();
    await expect(page.getByLabel("Send export to")).toHaveText(
      "Email me a download link"
    );
    await page.getByRole("button", { name: "Start export" }).click();
    await page
      .getByRole("button", { name: "Confirm export", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Export requested" })
    ).toBeFocused();
    await expect(
      page.getByText("Email download", { exact: true })
    ).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "test-results/event-stream-export-success-email.png",
      fullPage: true,
      animations: "disabled",
    });
  });
  test("S3 settings hide webhook controls on desktop and mobile", async ({
    authenticatedPage: page,
  }) => {
    const { writes } = await streamMocks(page);
    await page.goto("/settings/developers/event_stream");
    await page
      .getByRole("button", { name: "Backup bucket", exact: true })
      .click();
    const details = page.getByRole("dialog", {
      name: "Backup bucket",
      exact: true,
    });
    await expect(details.getByText("Batch size", { exact: true })).toHaveCount(
      0
    );
    await expect(details.getByText("Concurrency", { exact: true })).toHaveCount(
      0
    );
    await details.getByRole("button", { name: "Edit", exact: true }).click();
    const form = page.getByRole("dialog", {
      name: "Edit destination",
      exact: true,
    });
    await form.getByRole("button", { name: /Advanced settings/ }).click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(form.getByLabel("Batch size")).toHaveCount(0);
      await expect(form.getByLabel("Concurrency")).toHaveCount(0);
      await form
        .getByLabel("Object prefix (optional)")
        .scrollIntoViewIfNeeded();
      await expect(
        form.getByLabel("Object prefix (optional)")
      ).toBeInViewport();
      await page.screenshot({
        path: `test-results/event-stream-s3-settings-${width}.png`,
      });
    }
    await form.getByLabel("Object prefix (optional)").fill("analytics/");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(details).toBeVisible();
    expect(
      writes.find((write) => write.method === "PATCH")?.body
    ).toMatchObject({ settings: { prefix: "analytics/" } });
  });

  test("S3 validation errors stay visible in the modal and settings survive a retry", async ({
    authenticatedPage: page,
  }) => {
    await streamMocks(page);
    let reject = true;
    const message = "Settings endpoint must not resolve to a private address";
    await page.route(
      "**/api/v1/projects/*/event_destinations",
      async (route) => {
        if (route.request().method() === "POST" && reject) {
          return route.fulfill({ status: 422, json: { error: message } });
        }
        return route.fallback();
      }
    );
    await page.goto("/settings/developers/event_stream");
    await page.getByRole("button", { name: "Add destination" }).click();
    const dialog = page.getByRole("dialog", { name: "Add destination" });
    await dialog.getByLabel("Name", { exact: true }).fill("Test S3 bucket");
    await dialog.getByLabel("Destination type").click();
    await page.getByRole("option", { name: "S3-compatible bucket" }).click();
    await dialog.getByLabel("Bucket", { exact: true }).fill("events");
    await dialog.getByLabel("Region", { exact: true }).fill("fsn1");
    const endpoint = dialog.getByLabel("S3 endpoint URL (optional for AWS)");
    await endpoint.fill("https://internal.example.com");
    await dialog.getByLabel("Access key ID").fill("dummy-key");
    await dialog.getByLabel("Secret access key").fill("dummy-secret");
    await dialog.getByRole("button", { name: "Create and enable" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(message);
    await expect(page.getByText(message, { exact: true })).toHaveCount(1);
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await dialog.getByLabel("Name", { exact: true }).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole("alert")).toBeInViewport();
      await expect(
        dialog.getByRole("button", { name: "Create and enable" })
      ).toBeInViewport();
      await page.screenshot({
        path: `test-results/event-stream-s3-error-${viewport.width}.png`,
      });
    }
    await expect(dialog.getByLabel("Bucket", { exact: true })).toHaveValue(
      "events"
    );
    await expect(dialog.getByLabel("Secret access key")).toHaveValue(
      "dummy-secret"
    );
    await endpoint.fill("https://fsn1.your-objectstorage.com");
    reject = false;
    await dialog.getByRole("button", { name: "Create and enable" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Test S3 bucket", exact: true })
    ).toBeVisible();
    await expect(page.getByText(message, { exact: true })).toHaveCount(0);
  });
  test("pull feed links to documentation and revoking access requires confirmation", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    const { writes } = await streamMocks(page);
    await page.goto("/settings/developers/event_stream");
    await page.getByRole("tab", { name: "Pull feed tokens" }).click();
    const tokenTab = page.getByRole("tab", { name: "Pull feed tokens" });
    await expect(tokenTab).toHaveText("Pull feed tokens1");
    const revoke = page.getByRole("button", {
      name: "Revoke Warehouse reader",
      exact: true,
    });
    await expect(revoke).toBeVisible();
    await expect(revoke).toHaveText("");
    const neutralColor = await revoke.evaluate(
      (el) => getComputedStyle(el).color
    );
    await revoke.hover();
    await expect
      .poll(() => revoke.evaluate((el) => getComputedStyle(el).color))
      .not.toBe(neutralColor);
    await page.mouse.move(0, 0);
    const guide = page.getByRole("link", { name: /How to read the feed/ });
    await expect(guide).toBeVisible();
    await expect(guide).toHaveAttribute(
      "href",
      /\/docs\/enterprise\/event-stream$/
    );
    await expect(guide).toHaveAttribute("target", "_blank");
    await expect(
      page.getByRole("button", { name: "How to read the feed", exact: true })
    ).toHaveCount(0);
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-pull-feed.png",
      fullPage: true,
    });
    await revoke.click();
    expect(writes.filter((write) => write.method === "DELETE")).toHaveLength(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(revoke).toBeFocused();
    await revoke.click();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-revoke-token.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Revoke token", exact: true })
      .click();
    await expect(revoke).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Create feed token", exact: true })
    ).toBeFocused();
    await expect(tokenTab).toHaveText("Pull feed tokens0");
    expect(writes.filter((write) => write.method === "DELETE")).toEqual([
      expect.objectContaining({
        path: expect.stringContaining("/event_stream_tokens/t-existing"),
      }),
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(guide).toBeVisible();
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-pull-feed-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  });
  test("member can inspect delivery health and instructions on a narrow screen without token requests", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { writes, tokenReads } = await streamMocks(page, true);
    await page.goto("/settings/developers/event_stream");
    await expect(
      page.getByRole("button", { name: "View Production warehouse details" })
    ).toBeInViewport();
    await page
      .getByRole("button", { name: "View Production warehouse details" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Production warehouse" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add destination" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Send test event" })
    ).toHaveCount(0);
    await page.screenshot({
      animations: "disabled",
      path: "test-results/event-stream-mobile.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Pull feed tokens" }).click();
    await expect(page.getByText(/Ask an instance admin/)).toBeVisible();
    await page.getByRole("tab", { name: "Exports" }).click();
    await expect(page.getByText(/An instance admin can export/)).toBeVisible();
    expect(tokenReads).toHaveLength(0);
    expect(writes).toHaveLength(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  });
});
