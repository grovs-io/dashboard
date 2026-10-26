import { test, expect } from "../../fixtures/base-fixtures";
import type { Page } from "@playwright/test";
import { TEST_INSTANCE, TEST_PROJECT } from "../../fixtures/test-data";
import { catalogue } from "../../../ee/lib/__tests__/fixtures";
import { inAppExperiment } from "../../../ee/lib/__tests__/inAppFixtures";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Campaign = Record<string, any>;

function buildCampaign(over: Campaign = {}): Campaign {
  return {
    id: "camp-e2e-1",
    name: "",
    title: "",
    body: "",
    image_url: null,
    image: null,
    sound: null,
    data: {},
    link_id: null,
    source: "dashboard",
    status: "draft",
    scheduled_at: null,
    local_time: false,
    timezone: "UTC",
    evaluated_at: null,
    started_at: null,
    finished_at: null,
    failure_reason: null,
    audience: {
      type: "visitors",
      recipients_count: 0,
      recipients: [],
      segment_id: null,
      segment_definition_hash: null,
    },
    report: {
      targeted: 0,
      no_channel: 0,
      not_found: 0,
      queued: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      cancelled: 0,
      held: 0,
      waiting: 0,
      error_counts: {},
      audience: { persons: null, devices: null, incomplete: false },
    },
    control_group: null,
    conversion: null,
    variants: null,
    test_share: null,
    winner_after_minutes: null,
    winner_by: null,
    winner_due_at: null,
    winner: null,
    created_at: "2026-09-23T00:00:00Z",
    updated_at: "2026-09-23T00:00:00Z",
    ...over,
  };
}

const BASE = `/api/v1/projects/${TEST_PROJECT.id}/push_campaigns`;
const SHOTS = process.env.IN_APP_SHOTS;

const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const PUSH_CONFIGURED = [
  {
    platform: "ios",
    configuration: {
      bundle_id: "com.acme.app",
      app_prefix: "TEAM123",
      push_configuration: { configured: true },
    },
  },
  {
    platform: "android",
    configuration: { push_configuration: { firebase_project_id: "acme-fb" } },
  },
];

function estimateOf(reachable: number) {
  return {
    devices: reachable,
    no_channel: 0,
    not_found: 0,
    no_app: 0,
    reachable,
    platforms: {
      ios: { devices: reachable, configured: true },
      android: { devices: 0, configured: true },
    },
  };
}

// Registered after the shared mocks, so it wins for the configurations endpoint.
async function mockPushConfig(page: Page, configurations: unknown[]) {
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/configurations`,
    (route) => route.fulfill({ json: { configurations } })
  );
}

test.describe("Push campaigns", () => {
  // Routes added later win, so a test that needs another setup just mocks it again.
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await mockPushConfig(page, PUSH_CONFIGURED);
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/segments/fields`,
      (route) => route.fulfill({ json: catalogue })
    );
    await page.route(/\/api\/v1\/projects\/[^/]+\/segments(\?.*)?$/, (route) =>
      route.fulfill({ json: { segments: [], truncated: false } })
    );
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/in_app_settings`,
      (route) =>
        route.fulfill({
          json: {
            in_app_settings: {
              enabled: true,
              session_cap: 10,
              day_cap: 10,
              control_group: 0,
            },
          },
        })
    );
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/analytics/events/field-values**`,
      (route) =>
        route.fulfill({
          json: { values: ["checkout", "cart_viewed"], next_cursor: null },
        })
    );
  });

  test("an experiment shows its groups and offers the rest to a variant, and the composer has the section", async ({
    authenticatedPage: page,
  }) => {
    let campaign = buildCampaign({
      id: "camp-exp-1",
      name: "Autumn sale test",
      title: "Autumn sale",
      body: "Twenty percent off",
      status: "sent",
      started_at: "2026-09-20T10:00:00Z",
      control_group: 10,
      conversion: { event: "checkout", window_hours: 72 },
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      test_share: 20,
      winner_after_minutes: 120,
      winner_by: "opens",
      // About two hours ahead, so the banner counts down.
      winner_due_at: new Date(Date.now() + 118 * 60_000).toISOString(),
      report: {
        ...buildCampaign().report,
        targeted: 8218,
        delivered: 8100,
        opened: 1312,
        held: 910,
        waiting: 3120,
      },
    });
    const writes: { path: string; body: unknown }[] = [];
    // Later routes win: the catch-all goes first.
    await page.route(`**${BASE}**`, (route) =>
      route.fulfill({
        json: { push_campaigns: [campaign], truncated: false },
      })
    );

    await page.route(`**${BASE}/camp-exp-1/experiment**`, (route) =>
      route.fulfill({
        json: { experiment: inAppExperiment({ test_share: 20 }) },
      })
    );
    await page.route(`**${BASE}/camp-exp-1/deliveries*`, (route) =>
      route.fulfill({ json: { deliveries: [], next_after: null } })
    );
    await page.route(`**${BASE}/camp-exp-1/send_winner`, (route) => {
      writes.push({
        path: "send_winner",
        body: route.request().postDataJSON(),
      });
      campaign = {
        ...campaign,
        status: "sending",
        winner: "b",
        winner_due_at: null,
      };
      return route.fulfill({ status: 202, json: { push_campaign: campaign } });
    });
    await page.route(`**${BASE}/camp-exp-1`, (route) =>
      route.fulfill({ json: { push_campaign: campaign } })
    );
    await page.goto("/push");
    await expect(
      page.getByRole("table").getByText("Waiting for the winner")
    ).toBeVisible();

    await page.goto("/push/camp-exp-1");
    await expect(page.getByText("Sent to the test share")).toBeVisible();
    const banner = page.getByRole("status");
    await expect(banner).toContainText(
      "3,120 people are waiting for the winner"
    );
    await expect(banner).toContainText(
      /Goes out automatically in 1 h 5\d min \d+ s \(at .*\)/
    );
    await expect(banner).toContainText(
      "Judged by opens · B leads: 17.1% vs 14.8%"
    );
    // The countdown ticks by the second.
    const first = await banner.textContent();
    await page.waitForTimeout(1_500);
    expect(await banner.textContent()).not.toBe(first);
    if (SHOTS) await page.setViewportSize({ width: 1440, height: 1100 });
    await shot(page, "push-waiting-banner");
    await banner.getByRole("button", { name: "Choose a variant" }).click();
    await expect(
      page.getByRole("region", { name: "Experiment" })
    ).toBeInViewport();
    await banner
      .getByRole("button", { name: "Send B to the rest now" })
      .click();
    await page
      .getByRole("dialog", {
        name: "Send variant B to the 3,120 people waiting?",
      })
      .getByRole("button", { name: "Not now" })
      .click();
    const reach = page.getByRole("region", { name: "Reach" });
    await expect(reach.getByText("Waiting for the winner")).toBeVisible();
    await expect(reach.getByText("Control group")).toBeVisible();
    // One Notification card lists the variants and previews the chosen one.
    const notification = page.getByRole("region", {
      name: "Notification",
      exact: true,
      exact: true,
    });
    await expect(
      notification.getByRole("radio", { name: "B", exact: true })
    ).toContainText("Sale on");
    await notification.getByRole("radio", { name: "B", exact: true }).click();
    await expect(page.getByTestId("push-preview")).toContainText("Sale on");
    await expect(page.getByRole("region", { name: "Variants" })).toHaveCount(0);

    const card = page.getByRole("region", { name: "Experiment" });
    await expect(card).toContainText("Goal: checkout within 3 days");
    await expect(
      card.getByRole("columnheader", { name: /Opened/ })
    ).toBeVisible();
    await expect(card.getByRole("row")).toHaveCount(5);
    await expect(
      card.getByText(
        "Variants convert 83% better than the control: about +47 conversions (99% confidence)."
      )
    ).toBeVisible();
    await card
      .getByRole("button", { name: "Send variant B to the rest" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Send variant B to the 3,120 people waiting?",
    });
    await dialog.getByRole("button", { name: "Send to the rest" }).click();
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([{ path: "send_winner", body: { variant: "b" } }]);
    await expect(page.getByRole("status")).toHaveText(
      "Variant B is going out to the rest…"
    );
    await expect(
      page
        .getByRole("region", { name: "Notification", exact: true })
        .getByText("sent to the rest")
    ).toBeVisible();
    await page
      .getByRole("region", { name: "Notification", exact: true })
      .scrollIntoViewIfNeeded();
    await shot(page, "push-notification-card");
    await expect(card.getByRole("button", { name: /to the rest/ })).toHaveCount(
      0
    );

    await page.goto("/push");
    await page.getByRole("button", { name: "New campaign" }).first().click();
    const composer = page.getByRole("dialog", { name: "Create push campaign" });
    await composer.getByLabel("Title").fill("Autumn sale");
    await composer.getByLabel("Body").fill("Twenty percent off");
    await composer.getByRole("button", { name: "Add variant" }).click();
    const bar = composer.getByRole("radiogroup", { name: "Variant" });
    await expect(bar.getByRole("radio", { name: "B" })).toBeChecked();
    await expect(composer.getByLabel("Title")).toHaveValue("Autumn sale");
    await composer.getByLabel("Title").fill("Hi there");
    await expect(composer.getByTestId("push-preview")).toContainText(
      "Hi there"
    );
    await bar.getByRole("radio", { name: "A" }).click();
    await expect(composer.getByTestId("push-preview")).toContainText(
      "Autumn sale"
    );
    await composer
      .getByRole("navigation", { name: "Campaign sections" })
      .getByRole("button", { name: /Experiment/ })
      .click();
    await expect(
      composer.getByRole("heading", { name: "Experiment" })
    ).toBeVisible();
    await expect(composer.getByText("Who gets what")).toBeVisible();
    await expect(
      composer.getByRole("combobox", { name: "Test share" })
    ).toBeVisible();
  });

  test("list page renders campaigns, audience/status columns and the status filter", async ({
    authenticatedPage: page,
  }) => {
    const draft = buildCampaign({
      id: "camp-list-draft",
      name: "Draft sale",
      title: "Flash notice",
      status: "draft",
      audience: {
        type: "identifiers",
        recipients_count: 5,
        recipients: [],
        segment_id: null,
        segment_definition_hash: null,
      },
    });
    const scheduled = buildCampaign({
      id: "camp-list-sched",
      name: "Scheduled sale",
      title: "Weekend notice",
      status: "scheduled",
      scheduled_at: "2026-10-01T09:00:00Z",
      audience: {
        type: "visitors",
        recipients_count: 12,
        recipients: [],
        segment_id: null,
        segment_definition_hash: null,
      },
    });
    const all = [draft, scheduled];
    const copy = buildCampaign({
      ...draft,
      id: "camp-list-copy",
      audience: { ...draft.audience, recipients: ["u1", "u2"] },
    });
    const creates: unknown[] = [];

    await page.route(`**${BASE}**`, (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/estimate"))
        return route.fulfill({
          json: estimateOf(2),
        });
      if (request.method() === "POST" && url.pathname === BASE) {
        creates.push(request.postDataJSON());
        return route.fulfill({ status: 201, json: { push_campaign: copy } });
      }
      if (request.method() !== "GET")
        return route.fulfill({ status: 404, json: { error: "Not found" } });
      const one = [...all, copy].find((c) =>
        url.pathname.endsWith(`/push_campaigns/${c.id}`)
      );
      if (one)
        return route.fulfill({
          json: {
            push_campaign: {
              ...one,
              audience: { ...one.audience, recipients: ["u1", "u2"] },
            },
          },
        });
      const status = url.searchParams.get("status");
      const rows = status ? all.filter((c) => c.status === status) : all;
      // List rows are slim: the API leaves out the recipients.
      const slim = rows.map((c) => ({
        ...c,
        audience: { ...c.audience, recipients: undefined },
      }));
      return route.fulfill({
        json: { push_campaigns: slim, truncated: false },
      });
    });
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/segments*`,
      (route) => route.fulfill({ json: { segments: [], truncated: false } })
    );

    await page.goto("/push");
    const table = page.getByRole("table", { name: "Push campaigns" });
    await expect(table).toBeVisible();
    await expect(table.getByText("Draft sale")).toBeVisible();
    await expect(table.getByText("Scheduled sale")).toBeVisible();
    await expect(table.getByText("5 user ids")).toBeVisible();
    await expect(table.getByText("12 devices")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New campaign" }).first()
    ).toBeVisible();

    // Duplicate fetches the full record, creates the copy and opens it in the composer.
    await page.getByRole("button", { name: "Actions for Draft sale" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    const composer = page.getByRole("dialog", { name: "Edit push campaign" });
    await expect(composer).toBeVisible();
    await expect(composer.getByLabel("Title")).toHaveValue("Flash notice");
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({
      name: "Draft sale",
      title: "Flash notice",
      audience: { type: "identifiers", recipients: ["u1", "u2"] },
    });
    await composer.getByRole("button", { name: "Close dialog" }).click();
    await expect(composer).not.toBeVisible();

    // Status filter, driven through the URL the Select syncs to.
    await page.goto("/push?status=draft");
    await expect(page.getByText("Draft sale")).toBeVisible();
    await expect(page.getByText("Scheduled sale")).not.toBeVisible();
  });

  test("renders reach funnel, failures, deliveries and the breadcrumb from a fixture report", async ({
    authenticatedPage: page,
  }) => {
    const campaign = buildCampaign({
      id: "camp-fixture-1",
      name: "Weekend flash sale",
      title: "Flash sale is live",
      body: "50% off for 24 hours",
      status: "sent",
      finished_at: "2026-09-20T18:00:00Z",
      audience: {
        type: "segment",
        recipients_count: 0,
        recipients: [],
        segment_id: "seg-1",
        segment_definition_hash: "h1",
      },
      report: {
        targeted: 1200,
        no_channel: 40,
        not_found: 10,
        queued: 5,
        delivered: 1100,
        failed: 45,
        opened: 300,
        cancelled: 0,
        error_counts: { Unregistered: 30, "404": 15 },
        audience: { persons: 1180, devices: 1200, incomplete: false },
      },
    });

    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/push_campaigns/camp-fixture-1`,
      (route) => route.fulfill({ json: { push_campaign: campaign } })
    );
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/push_campaigns/camp-fixture-1/deliveries*`,
      (route) =>
        route.fulfill({
          json: {
            deliveries: [
              {
                id: 1,
                status: "delivered",
                platform: "ios",
                recipient: "user_42",
                error: null,
                opened_at: "2026-09-20T18:05:00Z",
                visitor: { id: 9, uuid: "v-9", sdk_identifier: "user_42" },
              },
              {
                id: 2,
                status: "failed",
                platform: "android",
                recipient: null,
                error: "404",
                opened_at: null,
                visitor: null,
              },
            ],
            next_after: null,
          },
        })
    );

    await page.goto("/push/camp-fixture-1");

    await expect(
      page.getByRole("heading", { name: "Weekend flash sale", level: 2 })
    ).toBeVisible();
    await expect(page.getByText("Sent", { exact: true })).toBeVisible();

    // Breadcrumb reads "Push › Details": never the campaign name or the raw hashid.
    const breadcrumb = page.getByLabel("breadcrumb");
    await expect(
      breadcrumb.getByRole("link", { name: "Push" })
    ).toHaveAttribute("href", /^\/push\/?(\?|$)/);
    await expect(breadcrumb.getByText("Details")).toBeVisible();
    await expect(breadcrumb.getByText("Weekend flash sale")).not.toBeVisible();
    await expect(breadcrumb.getByText("camp-fixture-1")).not.toBeVisible();

    // Reach funnel (scoped: "Delivered" also appears as a delivery-row badge below)
    const reach = page.getByRole("region", { name: "Reach" });
    await expect(reach.getByText("1,200")).toBeVisible();
    await expect(reach.getByText("Targeted", { exact: true })).toBeVisible();
    await expect(reach.getByText("1,100")).toBeVisible();
    await expect(reach.getByText("Delivered", { exact: true })).toBeVisible();

    // Failures by reason
    const failures = page.getByRole("region", { name: "Failures by reason" });
    await expect(
      failures.getByText("Device uninstalled or token expired")
    ).toBeVisible();
    await expect(failures.getByText("30")).toBeVisible();
    await expect(failures.getByText("Device not registered")).toBeVisible();

    // Deliveries
    const deliveries = page.getByRole("table", { name: "Deliveries" });
    await expect(
      deliveries.getByRole("button", { name: "Open visitor user_42" })
    ).toBeVisible();
    await expect(deliveries.getByText("Delivered")).toBeVisible();
    await expect(deliveries.getByText("Failed")).toBeVisible();
  });

  test("composes, schedules and confirms a campaign from the list, then opens its report", async ({
    authenticatedPage: page,
  }) => {
    let campaign = buildCampaign({ id: "camp-new-1" });
    const writes: { method: string; path: string; body: unknown }[] = [];

    await page.route(`**${BASE}**`, (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (method !== "GET")
        writes.push({ method, path, body: request.postDataJSON() });
      if (path.endsWith("/estimate"))
        return route.fulfill({
          json: estimateOf(2),
        });
      if (path.endsWith("/deliveries"))
        return route.fulfill({ json: { deliveries: [], next_after: null } });
      if (path.endsWith("/send")) {
        const body = request.postDataJSON();
        campaign = {
          ...campaign,
          status: "scheduled",
          scheduled_at: body.scheduled_at,
        };
        return route.fulfill({ json: { push_campaign: campaign } });
      }
      if (path === BASE && method === "POST") {
        const body = request.postDataJSON();
        campaign = {
          ...campaign,
          name: body.name,
          title: body.title,
          body: body.body,
          sound: body.sound,
          audience: {
            ...campaign.audience,
            type: body.audience.type,
            recipients: body.audience.recipients,
            recipients_count: body.audience.recipients.length,
          },
        };
        return route.fulfill({
          status: 201,
          json: { push_campaign: campaign },
        });
      }
      if (path === BASE)
        return route.fulfill({
          json: { push_campaigns: [], truncated: false },
        });
      return route.fulfill({ json: { push_campaign: campaign } });
    });
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/segments*`,
      (route) => route.fulfill({ json: { segments: [], truncated: false } })
    );

    await page.goto("/push");
    await page.getByRole("button", { name: "New campaign" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create push campaign" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Title").fill("Autumn sale");
    await dialog.getByLabel("Body").fill("Everything 30% off today");
    await expect(dialog.getByTestId("push-preview")).toContainText(
      "Autumn sale"
    );

    const sections = dialog.getByRole("navigation", {
      name: "Campaign sections",
    });
    await sections.getByRole("button", { name: /Audience/ }).click();
    await dialog.getByRole("tab", { name: "Devices" }).click();
    await dialog
      .getByLabel("Device ids, one per line or comma-separated")
      .fill("device-uuid-1\ndevice-uuid-2");
    await expect
      .poll(
        () =>
          writes.filter((w) => w.method === "POST" && w.path === BASE).length
      )
      .toBe(1);
    await expect(dialog.getByLabel("Estimated reach")).toContainText(
      "2devices will receive it"
    );
    expect(writes.find((w) => w.path === `${BASE}/estimate`)?.body).toEqual({
      audience: {
        type: "visitors",
        recipients: ["device-uuid-1", "device-uuid-2"],
      },
    });

    await sections.getByRole("button", { name: /Delivery/ }).click();
    await dialog.getByRole("radio", { name: "Schedule" }).click();
    const target = new Date();
    target.setDate(target.getDate() + 3);
    await dialog.getByRole("button", { name: "Date" }).click();
    const day = page.locator(
      `button[data-day="${target.toLocaleDateString("en-US")}"]`
    );
    if (!(await day.isVisible()))
      await page.getByRole("button", { name: /next month/i }).click();
    await day.click();
    await dialog.getByRole("combobox", { name: "Time" }).click();
    await page.getByPlaceholder("Type a time, e.g. 09:07").fill("10:30");
    await page.getByRole("option", { name: "10:30" }).click();
    await expect(dialog.getByText(/^Sends .* at 10:30 /)).toBeVisible();

    await dialog.getByRole("button", { name: "Schedule…" }).click();
    const confirm = page.getByRole("dialog", {
      name: "Schedule this campaign?",
    });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText("Autumn sale")).toBeVisible();
    await expect(confirm.getByText("2 devices").first()).toBeVisible();
    await confirm.getByRole("button", { name: "Schedule" }).click();

    await expect(page).toHaveURL(/\/push\/camp-new-1$/);
    await expect(
      page.getByRole("heading", { name: "Autumn sale", level: 2 })
    ).toBeVisible();

    const create = writes.find((w) => w.method === "POST" && w.path === BASE);
    expect(create?.body).toMatchObject({
      name: "Autumn sale",
      title: "Autumn sale",
      sound: "default",
      audience: {
        type: "visitors",
        recipients: ["device-uuid-1", "device-uuid-2"],
      },
    });
    const send = writes.find((w) => w.path.endsWith("/send"));
    expect(send?.body).toMatchObject({
      local_time: false,
      scheduled_at: expect.stringMatching(/T\d{2}:30:00\.000Z$/),
    });
  });

  test("sends a campaign now from the composer, confirms, then opens its report", async ({
    authenticatedPage: page,
  }) => {
    let campaign = buildCampaign({ id: "camp-now-1" });
    const writes: { method: string; path: string; body: unknown }[] = [];

    await page.route(`**${BASE}**`, (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (method !== "GET")
        writes.push({ method, path, body: request.postDataJSON() });
      if (path.endsWith("/estimate"))
        return route.fulfill({
          json: estimateOf(1),
        });
      if (path.endsWith("/deliveries"))
        return route.fulfill({ json: { deliveries: [], next_after: null } });
      if (path.endsWith("/send")) {
        campaign = {
          ...campaign,
          status: "sent",
          started_at: "2026-09-23T10:00:00Z",
          finished_at: "2026-09-23T10:00:05Z",
          report: { ...campaign.report, targeted: 1, delivered: 1 },
        };
        return route.fulfill({ json: { push_campaign: campaign } });
      }
      if (path === BASE && method === "POST") {
        const body = request.postDataJSON();
        campaign = {
          ...campaign,
          name: body.name,
          title: body.title,
          body: body.body,
          sound: body.sound,
          audience: {
            ...campaign.audience,
            type: body.audience.type,
            recipients: body.audience.recipients,
            recipients_count: body.audience.recipients.length,
          },
        };
        return route.fulfill({
          status: 201,
          json: { push_campaign: campaign },
        });
      }
      if (path === BASE)
        return route.fulfill({
          json: { push_campaigns: [], truncated: false },
        });
      return route.fulfill({ json: { push_campaign: campaign } });
    });
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/segments*`,
      (route) => route.fulfill({ json: { segments: [], truncated: false } })
    );

    await page.goto("/push");
    await page.getByRole("button", { name: "New campaign" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create push campaign" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Title").fill("Flash deal");
    await dialog.getByLabel("Body").fill("Ends in one hour");
    const sections = dialog.getByRole("navigation", {
      name: "Campaign sections",
    });
    await sections.getByRole("button", { name: /Audience/ }).click();
    await dialog.getByRole("tab", { name: "Devices" }).click();
    await dialog
      .getByLabel("Device ids, one per line or comma-separated")
      .fill("device-uuid-9");
    await expect(dialog.getByLabel("Estimated reach")).toContainText(
      "1device will receive it"
    );

    await dialog.getByRole("button", { name: "Send now" }).click();
    const confirm = page.getByRole("dialog", {
      name: "Send this campaign now?",
    });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText("Flash deal")).toBeVisible();
    // Audience and Reach both read "1 device".
    await expect(confirm.getByText("1 device", { exact: true })).toHaveCount(2);
    await confirm.getByRole("button", { name: "Send now" }).click();

    await expect(page).toHaveURL(/\/push\/camp-now-1$/);
    await expect(
      page.getByRole("heading", { name: "Flash deal", level: 2 })
    ).toBeVisible();
    await expect(page.getByText("Sent", { exact: true })).toBeVisible();

    const sends = writes.filter((w) => w.path.endsWith("/send"));
    expect(sends).toHaveLength(1);
    expect(sends[0]?.body).toEqual({});
    expect(
      writes.filter((w) => w.method === "POST" && w.path === BASE)
    ).toHaveLength(1);
  });

  test("cancels a scheduled campaign from the list", async ({
    authenticatedPage: page,
  }) => {
    let scheduled = buildCampaign({
      id: "camp-cancel-1",
      name: "Friday promo",
      title: "Friday deals",
      status: "scheduled",
      scheduled_at: "2026-10-02T09:00:00Z",
    });
    const cancels: string[] = [];

    await page.route(`**${BASE}**`, (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith("/cancel") && request.method() === "POST") {
        cancels.push(path);
        scheduled = { ...scheduled, status: "cancelled" };
        return route.fulfill({ json: { push_campaign: scheduled } });
      }
      return route.fulfill({
        json: { push_campaigns: [scheduled], truncated: false },
      });
    });
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/segments*`,
      (route) => route.fulfill({ json: { segments: [], truncated: false } })
    );

    await page.goto("/push");
    const table = page.getByRole("table", { name: "Push campaigns" });
    await expect(table.getByText("Scheduled", { exact: true })).toBeVisible();

    await page
      .getByRole("button", { name: "Actions for Friday promo" })
      .click();
    await page.getByRole("menuitem", { name: "Cancel" }).click();
    const confirm = page.getByRole("dialog", { name: "Cancel this campaign?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel campaign" }).click();

    await expect(table.getByText("Cancelled", { exact: true })).toBeVisible();
    expect(cancels).toEqual([`${BASE}/camp-cancel-1/cancel`]);
  });

  test("shows the push onboarding instead of an empty list when no platform is set up", async ({
    authenticatedPage: page,
  }) => {
    await mockPushConfig(page, []);
    await page.route(`**${BASE}**`, (route) =>
      route.fulfill({ json: { push_campaigns: [], truncated: false } })
    );

    await page.goto("/push");
    await expect(
      page.getByRole("heading", {
        name: "Connect a platform to send push campaigns",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Set up iOS push" })
    ).toHaveAttribute("href", "/settings/developers/ios_setup");
    await expect(
      page.getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("href", "/settings/developers/android_setup");
    await expect(page.getByText("No push campaigns yet")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "New campaign" })
    ).toHaveCount(0);
  });

  test("keeps past campaigns and blocks Send now in a draft when no platform is set up", async ({
    authenticatedPage: page,
  }) => {
    await mockPushConfig(page, []);
    const draft = buildCampaign({
      id: "camp-nosetup-draft",
      name: "Old draft",
      title: "Hello",
      body: "World",
      audience: {
        type: "identifiers",
        recipients_count: 1,
        recipients: ["user_1"],
        segment_id: null,
        segment_definition_hash: null,
      },
    });
    await page.route(`**${BASE}**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/estimate"))
        return route.fulfill({
          json: {
            devices: 1,
            no_channel: 1,
            not_found: 0,
            no_app: 0,
            reachable: 0,
            platforms: {
              ios: { devices: 0, configured: false },
              android: { devices: 0, configured: false },
            },
          },
        });
      if (path.endsWith(`/${draft.id}`))
        return route.fulfill({ json: { push_campaign: draft } });
      return route.fulfill({
        json: { push_campaigns: [draft], truncated: false },
      });
    });

    await page.goto("/push");
    await expect(page.getByText("Set up push notifications")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New campaign" })
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: "Open push campaign Old draft" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Edit push campaign" });
    await dialog
      .getByRole("navigation", { name: "Campaign sections" })
      .getByRole("button", { name: /Audience/ })
      .click();
    await expect(dialog.getByText("Set up push notifications")).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("target", "_blank");
    await expect(
      dialog.getByRole("button", { name: "Send now" })
    ).toBeDisabled();
    await expect(
      dialog.getByText("Set up iOS or Android push to send now")
    ).toBeVisible();
  });

  test("shows a compact row, and still allows sending, when only one platform is set up", async ({
    authenticatedPage: page,
  }) => {
    await mockPushConfig(page, [PUSH_CONFIGURED[0]]);
    await page.route(`**${BASE}**`, (route) =>
      route.fulfill({ json: { push_campaigns: [], truncated: false } })
    );
    await page.route(
      `**/api/v1/projects/${TEST_PROJECT.id}/segments*`,
      (route) => route.fulfill({ json: { segments: [], truncated: false } })
    );

    await page.goto("/push");
    const row = page.getByRole("note", {
      name: "Android push isn't configured",
    });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("href", "/settings/developers/android_setup");
    await expect(page.getByText("Set up push notifications")).toHaveCount(0);

    await page.getByRole("button", { name: "New campaign" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create push campaign" });
    await dialog
      .getByRole("navigation", { name: "Campaign sections" })
      .getByRole("button", { name: /Audience/ })
      .click();
    await expect(
      dialog.getByRole("note", { name: "Android push isn't configured" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("target", "_blank");
    await expect(
      dialog.getByRole("button", { name: "Send now" })
    ).toBeEnabled();
  });
});
