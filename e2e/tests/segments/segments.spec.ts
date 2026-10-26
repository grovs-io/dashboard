import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/base-fixtures";
import { TEST_PROJECT } from "../../fixtures/test-data";
import { catalogue } from "../../../ee/lib/__tests__/fixtures";

const segment = {
  id: "seg-1",
  name: "Active iOS buyers",
  description: "iOS users who bought",
  definition: {
    version: 1,
    operator: "or",
    groups: [
      {
        operator: "and",
        conditions: [
          { type: "event", any: true, count: 1, window: { last_days: 30 } },
        ],
      },
    ],
  },
  definition_hash: "h1",
  archived: false,
  has_identifier_list: false,
  identifier_list: null,
  size: { date: "2026-09-22", persons: 38120, devices: 41230 },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-22T00:00:00Z",
};

async function segmentMocks(page: Page) {
  const writes: { path: string; method: string; body: unknown }[] = [];
  await page.route(/\/api\/v1\/projects\/[^/]+\/segment/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method !== "GET")
      writes.push({ path, method, body: request.postDataJSON() });
    if (path.endsWith("/segments/fields"))
      return route.fulfill({ json: catalogue });
    if (path.endsWith("/segments/estimate"))
      return route.fulfill({
        json: {
          persons: 120,
          devices: 150,
          approximate: true,
          incomplete: false,
        },
      });
    if (path.endsWith("/segment_exports"))
      return route.fulfill({ json: { exports: [] } });
    if (path.endsWith("/segments") && method === "GET")
      return route.fulfill({
        json: {
          segments: path.includes(TEST_PROJECT.id) ? [segment] : [],
          truncated: false,
        },
      });
    if (path.endsWith("/segments") && method === "POST")
      return route.fulfill({
        status: 201,
        json: {
          segment: { ...segment, ...request.postDataJSON(), id: "seg-new" },
        },
      });
    if (path.endsWith("/count"))
      return route.fulfill({
        json: {
          persons: 38120,
          devices: 41230,
          incomplete: false,
          result_id: "r1",
        },
      });
    if (path.endsWith("/size_history"))
      return route.fulfill({ json: { points: [] } });
    if (path.endsWith("/breakdown"))
      return route.fulfill({
        json: {
          by: "platform",
          total_persons: 38120,
          buckets: [{ value: "ios", label: "iOS", persons: 38120 }],
        },
      });
    if (path.endsWith("/users"))
      return route.fulfill({ json: { users: [], next_cursor: null } });
    if (path.endsWith("/seg-1") || path.endsWith("/seg-new"))
      return route.fulfill({ json: { segment } });
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return { writes };
}

test.describe("Segments", () => {
  test("the event picker scrolls with the mouse wheel inside the builder dialog", async ({
    authenticatedPage: page,
  }) => {
    await segmentMocks(page);
    const [event, ...rest] = catalogue.conditions;
    const types = [
      "app_open",
      "view",
      "open",
      "install",
      "reinstall",
      "time_spent",
      "reactivation",
      "user_referred",
      "custom",
    ];
    await page.route(/\/segments\/fields$/, (route) =>
      route.fulfill({
        json: {
          ...catalogue,
          conditions: [{ ...event, event_types: types }, ...rest],
        },
      })
    );
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto("/segments");
    await page.getByRole("button", { name: "New segment" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add condition" }).click();
    await page.getByRole("menuitem", { name: /Did an event/ }).click();
    await dialog.getByLabel("Event target").click();

    const list = page.locator("[data-slot=popover-content] [cmdk-list]");
    await expect(list).toBeVisible();
    const box = (await list.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(() => list.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
  });

  test("lists segments, opens the detail page and creates one in the builder", async ({
    authenticatedPage: page,
  }) => {
    const { writes } = await segmentMocks(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/segments");
    await expect(
      page.getByLabel("Main navigation").getByRole("link", { name: "Segments" })
    ).toBeVisible();
    await expect(page.getByText("Active iOS buyers")).toBeVisible();
    await expect(page.getByText("38,120")).toBeVisible();

    await page.getByText("Active iOS buyers").click();
    await expect(page).toHaveURL(/\/segments\/seg-1$/);
    await expect(page.getByLabel("breadcrumb")).toContainText(
      "Active iOS buyers"
    );
    await expect(page.getByText("41,230")).toBeVisible();
    await page.getByRole("tab", { name: "Members" }).click();
    await expect(
      page.getByText("This segment has no members right now.")
    ).toBeVisible();

    await page.goto("/segments");
    await page.getByRole("button", { name: "New segment" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Recent web visitors");
    await dialog.getByRole("button", { name: "Add condition" }).click();
    await page.getByRole("menuitem", { name: /Did an event/ }).click();
    await expect(dialog.getByLabel("Event target")).toBeVisible();
    await expect(dialog.getByLabel("Estimated reach")).toContainText("120");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/segments\/seg-new$/);
    const create = writes.find(
      (w) => w.method === "POST" && w.path.endsWith("/segments")
    );
    expect(create?.body).toMatchObject({
      name: "Recent web visitors",
      definition: { operator: "or" },
    });
  });
});
