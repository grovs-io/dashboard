import { test, expect } from "../../fixtures/base-fixtures";
import type { Page } from "@playwright/test";
import { TEST_INSTANCE, TEST_PROJECT } from "../../fixtures/test-data";
import { catalogue } from "../../../ee/lib/__tests__/fixtures";
import {
  experimentCampaign,
  inAppCampaign,
  inAppExperiment,
  inAppReport,
  questionCampaign,
} from "../../../ee/lib/__tests__/inAppFixtures";

const ROOT = `/api/v1/projects/${TEST_PROJECT.id}`;
const BASE = `${ROOT}/in_app_campaigns`;
const SHOTS = process.env.IN_APP_SHOTS;

const REPORT = {
  totals: {
    views: 1240,
    clicks: 310,
    dismissals: 820,
    unique_viewers: 990,
    unique_clickers: 280,
    click_rate: 0.25,
  },
  trend: [
    { bucket: "2026-09-26", views: 300, clicks: 60, dismissals: 210 },
    { bucket: "2026-09-27", views: 420, clicks: 110, dismissals: 280 },
    { bucket: "2026-09-28", views: 520, clicks: 140, dismissals: 330 },
  ],
  platforms: [
    { platform: "ios", views: 800, clicks: 220, dismissals: 520 },
    { platform: "web", views: 440, clicks: 90, dismissals: 300 },
  ],
  buttons: [
    { button_id: "shop", clicks: 280 },
    { button_id: null, clicks: 30 },
  ],
  eligible_devices: null,
};

const PLATFORMS = ["ios", "android", "web"];
const WORDS = [
  "Too slow when I open the cart.",
  "Love it",
  "The new search finds what I want much faster than before, and the filters finally remember what I chose last time. Please keep the old colours as an option though.",
  "Crashes on my tablet",
  "Works fine.\nWould like a dark mode.",
  "Checkout asked me to log in twice",
  "Great app, I use it every day on the way to work",
  "👍",
];

// Comments as a campaign gathers them: many people, several platforms, two weeks.
const demoComments = (count: number, answers: string[]) =>
  Array.from({ length: count }, (_, i) => ({
    value: answers[(i * 3) % answers.length]!,
    comment: WORDS[i % WORDS.length]!,
    at: new Date(Date.now() - (i * 5.3 + 0.4) * 3_600_000).toISOString(),
    platform: PLATFORMS[(i * 2) % 3]!,
  }));

const counts = (comments: { value: string }[], value: number | string) =>
  comments.filter((c) => c.value === String(value)).length;

const STAR_COMMENTS = demoComments(62, ["1", "2", "3", "3", "2", "5", "4"]);
const CHOICE_COMMENTS = demoComments(44, [
  "search",
  "friend",
  "social",
  "search",
  "ad",
]);

const demoReport = (answers: Record<string, unknown>) => ({
  ...inAppReport(null),
  totals: {
    views: 3120,
    clicks: 0,
    dismissals: 1985,
    unique_viewers: 2874,
    unique_clickers: 0,
    click_rate: 0,
  },
  trend: Array.from({ length: 14 }, (_, i) => ({
    bucket: new Date(Date.now() - (13 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10),
    views: 180 + ((i * 37) % 90),
    clicks: 0,
    dismissals: 110 + ((i * 23) % 60),
  })),
  platforms: [
    { platform: "ios", views: 1710, clicks: 0, dismissals: 1102 },
    { platform: "android", views: 1034, clicks: 0, dismissals: 640 },
    { platform: "web", views: 376, clicks: 0, dismissals: 243 },
  ],
  answers,
});

const STARS_REPORT = demoReport({
  type: "stars",
  count: 474,
  score: 4.12,
  values: [12, 21, 49, 225, 167].map((count, i) => ({
    value: i + 1,
    label: String(i + 1),
    count,
    comments: counts(STAR_COMMENTS, i + 1),
  })),
});

const CHOICES = [
  { id: "search", text: "Search", count: 151 },
  { id: "friend", text: "A friend", count: 96 },
  { id: "social", text: "Social media", count: 84 },
  { id: "ad", text: "An ad", count: 32 },
];
const CHOICE_REPORT = demoReport({
  type: "choice",
  count: 363,
  score: null,
  values: CHOICES.map((c) => ({
    value: c.id,
    label: c.text,
    count: c.count,
    comments: counts(CHOICE_COMMENTS, c.id),
  })),
});

const PAGE = 25;

interface Backend {
  campaigns: ReturnType<typeof inAppCampaign>[];
  writes: { method: string; path: string; body: unknown }[];
  settings: {
    enabled: boolean;
    session_cap: number;
    day_cap: number;
    control_group: number;
  };
  // The report of a campaign, by its id; any other gets the usual one.
  reports: Record<string, unknown>;
  comments: Record<string, { value: string }[]>;
  // Requests for these paths wait until the test releases them.
  holds: { paths: RegExp; until: Promise<void> }[];
}

// Holds matching requests until the returned function is called.
function hold(backend: Backend, paths: RegExp): () => void {
  let release = () => {};
  const held = { paths, until: new Promise<void>((done) => (release = done)) };
  backend.holds.push(held);
  return () => {
    backend.holds = backend.holds.filter((h) => h !== held);
    release();
  };
}

// A small stand-in for the API: it keeps what was saved, so a saved draft shows in the list.
async function mockBackend(page: Page, campaigns: Backend["campaigns"] = []) {
  // A registered web domain, so the list shows instead of the platform setup panel.
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/configurations`,
    (route) =>
      route.fulfill({
        json: {
          configurations: [
            { platform: "web", configuration: { domains: ["acme.io"] } },
          ],
        },
      })
  );
  const backend: Backend = {
    campaigns: [...campaigns],
    writes: [],
    settings: { enabled: true, session_cap: 10, day_cap: 10, control_group: 0 },
    reports: {},
    comments: {},
    holds: [],
  };
  await page.route(`**${ROOT}/segments/fields`, (route) =>
    route.fulfill({ json: catalogue })
  );
  await page.route(/\/api\/v1\/projects\/[^/]+\/segments(\?.*)?$/, (route) =>
    route.fulfill({ json: { segments: [], truncated: false } })
  );
  await page.route(`**${ROOT}/analytics/events/fields`, (route) =>
    route.fulfill({
      json: {
        fields: [
          { name: "event_name", type: "attribute" },
          { name: "total", type: "property" },
          { name: "user.first_name", type: "user_attribute" },
          { name: "user.plan", type: "user_attribute" },
        ],
      },
    })
  );
  await page.route(`**${ROOT}/analytics/events/field-values**`, (route) => {
    const field = new URL(route.request().url()).searchParams.get("field");
    const values =
      field === "screen_name"
        ? ["Home", "Checkout", "Profile"]
        : ["cart_viewed", "purchase_completed"];
    return route.fulfill({ json: { values, next_cursor: null } });
  });
  await page.route(`**${ROOT}/in_app_settings`, (route) => {
    if (route.request().method() === "PATCH") {
      Object.assign(backend.settings, route.request().postDataJSON());
      backend.writes.push({
        method: "PATCH",
        path: "in_app_settings",
        body: route.request().postDataJSON(),
      });
    }
    return route.fulfill({ json: { in_app_settings: backend.settings } });
  });
  await page.route(`**${BASE}**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    for (const h of backend.holds.filter((h) => h.paths.test(url.pathname)))
      await h.until;
    const method = request.method();
    const [id, action] = url.pathname.slice(BASE.length + 1).split("/");
    const found = backend.campaigns.find((c) => c.id === id);
    const one = (campaign: Backend["campaigns"][0], status = 200) =>
      route.fulfill({ status, json: { in_app_campaign: campaign } });
    if (method !== "GET")
      backend.writes.push({
        method,
        path: url.pathname.slice(BASE.length),
        body: request.postData() ? request.postDataJSON() : null,
      });

    if (!id && method === "GET") {
      const status = url.searchParams.get("status");
      const rows = backend.campaigns.filter(
        (c) => !status || c.status === status
      );
      return route.fulfill({
        json: { in_app_campaigns: rows, truncated: false, next_after: null },
      });
    }
    if (!id && method === "POST") {
      const created = inAppCampaign({
        id: `new-${backend.campaigns.length + 1}`,
        ...request.postDataJSON(),
        audience: inAppCampaign().audience,
      });
      backend.campaigns.unshift(created);
      return one(created, 201);
    }
    if (!found)
      return route.fulfill({
        status: 404,
        json: { error: "In-app campaign not found" },
      });
    if (action === "comments") {
      const values = url.searchParams.get("values")?.split(",");
      const all = (backend.comments[id!] ?? []).filter(
        (c) => !values || values.includes(c.value)
      );
      const from = Number(url.searchParams.get("before") ?? 0);
      return route.fulfill({
        json: {
          comments: all.slice(from, from + PAGE),
          next_before: from + PAGE < all.length ? String(from + PAGE) : null,
        },
      });
    }
    if (action === "answers")
      return route.fulfill({
        json: {
          answers: {
            type: found.content.question?.type,
            truncated: false,
            rows: (backend.comments[id!] as (typeof STAR_COMMENTS)[0][]).map(
              (c) => ({
                at: c.at,
                platform: c.platform,
                country: "RO",
                app_version: "2.1.0",
                answer: c.value,
                label: c.value,
                comment: c.comment,
                user: null,
              })
            ),
          },
        },
      });
    if (action === "report")
      return route.fulfill({
        json: { report: backend.reports[id!] ?? REPORT },
      });
    if (action === "experiment")
      return route.fulfill({ json: { experiment: inAppExperiment() } });
    if (method === "GET") return one(found);
    if (method === "PATCH") {
      Object.assign(found, request.postDataJSON(), {
        audience: found.audience,
      });
      return one(found);
    }
    if (method === "DELETE") {
      backend.campaigns = backend.campaigns.filter((c) => c.id !== id);
      return route.fulfill({ json: { message: "Deleted" } });
    }
    const next = {
      launch: "live",
      pause: "paused",
      resume: "live",
      end: "ended",
    }[action ?? ""];
    if (next) {
      found.status = next as typeof found.status;
      found.launched_at ??= "2026-09-28T10:00:00.000Z";
      return one(found, action === "launch" ? 202 : 200);
    }
    if (action === "duplicate") {
      const copy = {
        ...found,
        id: `${found.id}-copy`,
        name: `${found.name} copy`,
        status: "draft" as const,
        launched_at: null,
      };
      backend.campaigns.unshift(copy);
      return one(copy, 201);
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return backend;
}

// Tall enough to show a whole step of the composer in one picture.
const tall = async (page: Page) => {
  if (SHOTS) await page.setViewportSize({ width: 1440, height: 1100 });
};

const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  // Lets a popover or a colour finish its transition.
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const live = inAppCampaign({
  id: "live-1",
  name: "Autumn sale",
  status: "live",
  launched_at: "2026-09-26T10:00:00.000Z",
  content: {
    title: "Autumn sale",
    message: "Twenty percent off everything until Sunday.",
    buttons: [
      {
        id: "shop",
        text: "Shop now",
        action: { type: "open_url", url: "https://acme.example/sale" },
      },
      { id: "later", text: "Later", action: { type: "close" } },
    ],
  },
});
const draft = inAppCampaign({ id: "draft-1", name: "Welcome back" });

test.describe("In-app messages", () => {
  test("the list shows campaigns, filters by status, and offers each step where it applies", async ({
    authenticatedPage: page,
  }) => {
    await mockBackend(page, [live, draft]);
    await page.goto("/in_app");
    const table = page.getByRole("table", { name: "In-app messages" });
    await expect(table.getByText("Autumn sale")).toBeVisible();
    await expect(table.getByText("Welcome back")).toBeVisible();
    await expect(
      table.getByText('Event "cart_viewed" happens').first()
    ).toBeVisible();
    await expect(table.getByText("Everyone").first()).toBeVisible();
    await shot(page, "list");

    await page.getByRole("button", { name: "Actions for Autumn sale" }).click();
    for (const item of ["Open report", "Edit", "Duplicate", "Pause", "End"])
      await expect(
        page.getByRole("menuitem", { name: item, exact: true })
      ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page
      .getByRole("button", { name: "Actions for Welcome back" })
      .click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Pause" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Live" }).click();
    await expect(table.getByText("Welcome back")).toHaveCount(0);
    await expect(page).toHaveURL(/status=live/);
  });

  test("an empty project explains what an in-app message is", async ({
    authenticatedPage: page,
  }) => {
    await mockBackend(page);
    await page.goto("/in_app");
    await expect(page.getByText("No in-app messages yet")).toBeVisible();
    await shot(page, "empty");
  });

  test("composing, saving and launching a message", async ({
    authenticatedPage: page,
  }) => {
    const backend = await mockBackend(page);
    await page.goto("/in_app");
    await page.getByRole("button", { name: "New message" }).first().click();
    await page.getByRole("menuitem", { name: /Blank message/ }).click();
    const composer = page.getByRole("dialog", {
      name: "Create in-app message",
    });
    await composer.getByRole("combobox", { name: "Template" }).click();
    await expect(page.getByRole("option")).toHaveCount(10);
    await shot(page, "composer-template-list");
    await page.getByRole("option", { name: /^Half interstitial A/ }).click();
    await composer
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(
        "averyveryverylongwordwithnospacesatallthatmustwrapinsidethecard\nsecond line"
      );
    await expect(composer.getByTestId("in-app-preview-card")).toHaveJSProperty(
      "scrollWidth",
      await composer
        .getByTestId("in-app-preview-card")
        .evaluate((el) => el.clientWidth)
    );
    await shot(page, "composer-templates");
    for (const device of ["Phone landscape", "Web page"]) {
      await composer.getByRole("radio", { name: device }).click();
      await expect(
        composer.getByRole("img", { name: /Message preview/ })
      ).toBeVisible();
    }
    await composer
      .getByRole("button", { name: "Open a larger preview" })
      .click();
    await shot(page, "preview-web");
    await page
      .getByRole("dialog", { name: "Preview" })
      .getByRole("radio", { name: "Phone landscape" })
      .click();
    await shot(page, "preview-landscape");
    await page.keyboard.press("Escape");
    await composer.getByRole("radio", { name: "Phone", exact: true }).click();
    await composer.getByRole("combobox", { name: "Template" }).click();
    await page.getByRole("option", { name: /^Interstitial A/ }).click();
    const title = composer.getByRole("textbox", { name: "Title", exact: true });
    await title.fill("Hi ");
    await composer
      .getByRole("button", { name: "Insert a value into the title" })
      .click();
    await page.getByRole("option", { name: "first_name" }).click();
    await page.getByLabel(/Fallback text/).fill("there");
    await shot(page, "composer-insert");
    await page.getByRole("button", { name: "Insert", exact: true }).click();
    await expect(title).toHaveValue(
      'Hi {{ user.first_name | default: "there" }}'
    );
    await composer
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Twenty percent off everything until Sunday.");
    await composer.getByRole("button", { name: /Colours/ }).click();
    await composer.getByRole("radio", { name: "Dark" }).click();
    await expect(
      composer.getByRole("button", { name: "Background: #111827" })
    ).toBeVisible();
    await shot(page, "composer-colours");
    await composer.getByRole("radio", { name: "Light" }).click();
    await composer
      .getByRole("button", { name: "Background: automatic" })
      .click();
    await shot(page, "composer-colour-picker");
    await page.getByRole("option", { name: "#FFE08A" }).click();
    await composer.getByRole("button", { name: /Colours/ }).click();
    await composer.getByRole("button", { name: "Add button" }).click();
    await composer.getByLabel("Button 1 label").fill("Shop now");
    await composer.getByRole("combobox", { name: "Button 1 action" }).click();
    await page.getByRole("option", { name: "Open a link" }).click();
    await composer
      .getByLabel("Button 1 link")
      .fill("https://acme.example/sale");
    const preview = composer.getByTestId("in-app-preview-card");
    await expect(preview).toContainText("Hi there");
    await expect(preview).toContainText("Shop now");
    await shot(page, "composer-message");

    await composer.getByRole("button", { name: "Next" }).click();
    await composer.getByRole("radio", { name: /A screen is viewed/ }).click();
    await composer
      .getByRole("button", { name: "Trigger 1 screen name" })
      .click();
    await expect(page.getByRole("option", { name: "Checkout" })).toBeVisible();
    await shot(page, "composer-screens");
    await page.keyboard.press("Escape");
    await composer.getByRole("radio", { name: /An event is tracked/ }).click();
    await composer
      .getByRole("button", { name: "Trigger 1 event name" })
      .click();
    await page.getByRole("option", { name: "cart_viewed" }).click();
    await composer.getByRole("button", { name: "Add a filter" }).click();
    await composer.getByLabel("Filter 1 property").fill("total");
    await composer.getByRole("combobox", { name: "Filter 1 operator" }).click();
    await page.getByRole("option", { name: "is more than" }).click();
    await composer.getByLabel("Filter 1 value").fill("50");
    await shot(page, "composer-trigger");

    await composer.getByRole("button", { name: "Next" }).click();
    await composer.getByRole("button", { name: "Add a condition" }).click();
    await shot(page, "composer-audience");

    await composer.getByRole("button", { name: "Next" }).click();
    await expect(
      composer.getByRole("heading", { name: "Experiment" })
    ).toBeVisible();
    await shot(page, "composer-experiment");

    await composer.getByRole("button", { name: "Next" }).click();
    await composer.getByLabel("Times ever").fill("3");
    await composer
      .getByRole("switch", { name: /Only on certain days or hours/ })
      .click();
    await composer.getByRole("button", { name: "Sun" }).click();
    await shot(page, "composer-limits");

    await composer.getByRole("button", { name: "Next" }).click();
    await expect(
      composer.getByText('Event "cart_viewed" happens (1 filter)', {
        exact: true,
      })
    ).toBeVisible();
    await expect(composer.getByText("3 ever", { exact: true })).toBeVisible();
    await expect(composer.getByText("Platform is iOS")).toBeVisible();
    await shot(page, "composer-review");

    await composer.getByRole("button", { name: "Launch", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Launch this campaign?" })
      .getByRole("button", { name: "Launch", exact: true })
      .click();
    // The composer is already hidden behind the question, so the list is what shows the launch is done.
    await expect(
      page.getByRole("table", { name: "In-app messages" }).getByText("Live")
    ).toBeVisible();
    await expect(composer).toBeHidden();

    expect(backend.writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      "POST ",
      "POST /new-1/launch",
    ]);
    expect(backend.writes[0]?.body).toMatchObject({
      name: "Hi there",
      template: "interstitial",
      content: {
        title: 'Hi {{ user.first_name | default: "there" }}',
        colors: { background: "#FFE08A" },
        buttons: [
          {
            id: "button_1",
            text: "Shop now",
            action: { type: "open_url", url: "https://acme.example/sale" },
          },
        ],
      },
      triggers: [
        {
          type: "event",
          name: "cart_viewed",
          filters: [{ field: "total", op: "gt", value: "50" }],
        },
      ],
      conditions: [{ type: "platform", op: "eq", value: "ios" }],
      caps: { session: 1, lifetime: 3 },
      schedule: { days: [1, 2, 3, 4, 5, 7], from: "09:00", to: "21:00" },
      audience: { type: "all" },
    });
    await expect(
      page.getByRole("table", { name: "In-app messages" }).getByText("Live")
    ).toBeVisible();
  });

  test("a draft with nothing in it is not launched", async ({
    authenticatedPage: page,
  }) => {
    const backend = await mockBackend(page);
    await page.goto("/in_app");
    await page.getByRole("button", { name: "New message" }).first().click();
    await page.getByRole("menuitem", { name: /Blank message/ }).click();
    const composer = page.getByRole("dialog", {
      name: "Create in-app message",
    });
    await composer.getByRole("button", { name: "6 Check and launch" }).click();
    await composer.getByRole("button", { name: "Launch", exact: true }).click();
    await expect(
      composer.getByText(
        "The message has no text yet. Add a title or a message."
      )
    ).toBeVisible();
    expect(backend.writes).toEqual([]);
  });

  test("the report shows results, the setup and the message, and pauses the campaign", async ({
    authenticatedPage: page,
  }) => {
    const backend = await mockBackend(page, [{ ...live }]);
    await page.goto("/in_app/live-1");
    await expect(
      page.getByRole("heading", { name: "Autumn sale" })
    ).toBeVisible();
    await expect(page.getByText("1,240")).toBeVisible();
    await expect(page.getByText("25.0%")).toBeVisible();
    await expect(page.getByText("Tap on the message")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Shop now" })).toBeVisible();
    await expect(page.getByTestId("in-app-preview-card")).toContainText(
      "Twenty percent off"
    );
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toContainText("In-AppDetails");
    await shot(page, "report");

    // Going back through the breadcrumb must not reload the page: a reload forgets the selected project.
    await page.evaluate(() => {
      (window as unknown as { stayed?: boolean }).stayed = true;
    });
    await page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("link", { name: "In-App" })
      .click();
    await expect(
      page.getByRole("table", { name: "In-app messages" })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { stayed?: boolean }).stayed
      )
    ).toBe(true);
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Autumn sale" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
    await page.getByRole("button", { name: "End" }).click();
    await page
      .getByRole("dialog", { name: "End this campaign?" })
      .getByRole("button", { name: "End campaign" })
      .click();
    await expect(page.getByText("Ended", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    expect(backend.writes.map((w) => w.path)).toEqual([
      "/live-1/pause",
      "/live-1/end",
    ]);
  });

  test("a question made from the rate the app preset is sent with no buttons", async ({
    authenticatedPage: page,
  }) => {
    await tall(page);
    const backend = await mockBackend(page);
    await page.goto("/in_app");
    await page.getByRole("button", { name: "New message" }).first().click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText("Start from a template")).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Blank messageWrite it yourself, step by step",
      "Ask people to updateFor people on an old version of the app",
      "Rate the appFive stars, then an optional store review",
      "Quick questionPeople pick one answer from a list",
    ]);
    // A subtitle that does not fit would be cut short, not wrapped.
    for (const hint of await menu.locator("span.truncate").all())
      expect(
        await hint.evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await shot(page, "new-message-menu");
    await page.getByRole("menuitem", { name: /^Rate the app/ }).click();
    const composer = page.getByRole("dialog", {
      name: "Create in-app message",
    });
    await expect(
      composer.getByRole("radio", { name: /Answer a question/ })
    ).toBeChecked();
    await expect(composer.getByRole("radio", { name: /^Stars/ })).toBeChecked();
    const preview = composer.getByTestId("in-app-preview-card");
    await expect(preview).toContainText("Enjoying the app?");
    await expect(preview.locator("svg.lucide-star")).toHaveCount(5);
    const after = (name: string) => composer.getByRole("group", { name });
    await expect(after("1 to 3 stars").getByRole("combobox")).toContainText(
      "Ask what could be better"
    );
    await expect(after("1 to 3 stars").getByLabel("Question")).toHaveValue(
      "What could be better?"
    );
    await expect(after("4 or 5 stars").getByRole("combobox")).toContainText(
      "Ask for a store review"
    );
    await after("Thank-you message").scrollIntoViewIfNeeded();
    await shot(page, "question-stars-banner");
    await composer.getByRole("combobox", { name: "Template" }).click();
    await expect(page.getByRole("option", { name: /^Alert/ })).toBeDisabled();
    await expect(page.getByRole("option", { name: /^Alert/ })).toContainText(
      "Cannot hold a question"
    );
    await shot(page, "question-templates");
    await page.getByRole("option", { name: /^Interstitial A/ }).click();
    await expect(page.getByRole("listbox", { name: "Templates" })).toBeHidden();
    await composer
      .getByRole("radio", { name: /Answer a question/ })
      .scrollIntoViewIfNeeded();
    await shot(page, "question-stars");
    await composer.getByText("Kind of question").scrollIntoViewIfNeeded();
    await after("Thank-you message").scrollIntoViewIfNeeded();
    await shot(page, "question-stars-settings");
    await composer.getByRole("radio", { name: "Comment" }).click();
    await expect(preview).toContainText("What could be better?");
    await expect(
      composer.getByRole("radio", { name: "Comment" })
    ).toBeChecked();
    await expect(
      composer.getByRole("radio", { name: "Question", exact: true })
    ).not.toBeChecked();
    await shot(page, "question-comment");
    await composer.getByRole("radio", { name: "Thanks" }).click();
    await expect(preview).toContainText("Thank you");
    await shot(page, "question-thanks");

    await composer.getByRole("button", { name: "6 Check and launch" }).click();
    await expect(
      composer.getByText(
        "Asks for 1 to 5 stars. People who give 1 to 3 stars are asked “What could be better?”. People who give 4 or 5 stars are asked for a store review. Says “Thank you”."
      )
    ).toBeVisible();
    await expect(
      composer.getByText("A person who has answered is not asked again.")
    ).toBeVisible();
    await shot(page, "question-review");
    await composer.getByRole("button", { name: "Save draft" }).click();
    await expect.poll(() => backend.writes.length).toBe(1);
    expect(backend.writes[0]?.body).toMatchObject({
      name: "Rate the app",
      template: "interstitial",
      content: {
        title: "Enjoying the app?",
        buttons: [],
        tap_action: null,
        question: {
          id: "q1",
          type: "stars",
          options: [],
          comment: { split: 3, low: "What could be better?", high: null },
          thanks: "Thank you",
          review_from: 4,
        },
      },
      triggers: [{ type: "app_open" }],
    });
  });

  test("a list of choices is drawn in the preview as it is typed", async ({
    authenticatedPage: page,
  }) => {
    await tall(page);
    await mockBackend(page);
    await page.goto("/in_app");
    await page.getByRole("button", { name: "New message" }).first().click();
    await page.getByRole("menuitem", { name: /Quick question/ }).click();
    const composer = page.getByRole("dialog", {
      name: "Create in-app message",
    });
    await composer.getByLabel("Choice 1", { exact: true }).fill("Search");
    await composer.getByLabel("Choice 2", { exact: true }).fill("Offline mode");
    await composer.getByRole("button", { name: "Add choice" }).click();
    await composer.getByLabel("Choice 3", { exact: true }).fill("Sharing");
    await expect(composer.getByTestId("in-app-preview-card")).toContainText(
      "SearchOffline modeSharing"
    );
    await composer
      .getByRole("group", { name: "After the choice" })
      .getByRole("combobox")
      .click();
    await page
      .getByRole("option", { name: "Ask a follow-up question" })
      .click();
    await expect(
      composer
        .getByRole("group", { name: "After the choice" })
        .getByLabel("Question")
    ).toHaveValue("Anything to add?");
    await composer
      .getByRole("group", { name: "Thank-you message" })
      .scrollIntoViewIfNeeded();
    await shot(page, "question-choices");
  });

  const asked = {
    status: "live" as const,
    launched_at: "2026-09-20T10:00:00.000Z",
  };
  const rating = questionCampaign({ ...asked, name: "Demo: Rate the app" });
  const finding = questionCampaign({
    ...asked,
    id: "ask-2",
    name: "Demo: How did you find us?",
    template: "half_interstitial",
    content: {
      title: "How did you find us?",
      question: {
        id: "q1",
        type: "choice",
        options: CHOICES.map(({ id, text }) => ({ id, text })),
        comment: { split: null, low: "Anything to add?", high: null },
        thanks: null,
        review_from: null,
      },
    },
  });

  async function askedBackend(page: Page) {
    const backend = await mockBackend(page, [rating, finding]);
    backend.reports["ask-1"] = STARS_REPORT;
    backend.reports["ask-2"] = CHOICE_REPORT;
    backend.comments["ask-1"] = STAR_COMMENTS;
    backend.comments["ask-2"] = CHOICE_COMMENTS;
    return backend;
  }

  const whole = async (page: Page, name: string) => {
    if (!SHOTS) return;
    await page.waitForTimeout(400);
    // The page scrolls inside its shell, so the window is made as tall as what it holds.
    await page.setViewportSize({ width: 1440, height: 2000 });
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    await page.setViewportSize({ width: 1440, height: 1100 });
  };

  test("the report of a stars question: answers, comments page by page, and the export", async ({
    authenticatedPage: page,
  }) => {
    await tall(page);
    await askedBackend(page);
    await page.goto("/in_app/ask-1");
    await expect(page.getByRole("heading", { name: "Answers" })).toBeVisible();
    const bars = page.getByRole("region", { name: "What people answered" });
    await expect(bars).toContainText("4.1 out of 5 on average");
    await expect(bars.getByTestId("in-app-answer-bar")).toHaveCount(5);
    await expect(bars.getByTestId("in-app-answer-bar").last()).toBeVisible();

    // Answers stand where the clicks of a message with buttons would.
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.getByText("Answer rate")).toBeVisible();
    await expect(page.getByText("15.2%")).toBeVisible();
    await expect(page.getByText("474", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Click rate")).toHaveCount(0);
    await expect(page.getByText("Clicks by button")).toHaveCount(0);
    await expect(page.getByText("Clicks", { exact: true })).toHaveCount(0);

    const comments = page.getByRole("region", { name: /^Comments/ });
    await expect(comments).toContainText("Comments 62");
    const rows = comments.getByRole("listitem");
    await expect(rows).toHaveCount(25);
    await expect(rows.first()).toContainText("Too slow when I open the cart.");
    await expect(rows.first().getByRole("img")).toHaveAccessibleName("1 star");
    await expect(rows.first()).toContainText("iOS");
    await expect(rows.first()).toContainText("minutes ago");
    await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(
      0
    );
    await whole(page, "report-stars");

    // The end of the list coming into view brings the next page, until the last one.
    const area = page.getByTestId("in-app-comments");
    const toEnd = () => area.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await toEnd();
    await expect(rows).toHaveCount(50);
    await toEnd();
    await expect(rows).toHaveCount(62);
    await expect(comments.getByText("That is all of them.")).toBeVisible();

    await page.getByRole("combobox", { name: "Comments for" }).click();
    await expect(page.getByRole("group")).toHaveCount(2);
    await expect(page.getByRole("option")).toHaveCount(8);
    const low = [1, 2, 3].reduce((n, v) => n + counts(STAR_COMMENTS, v), 0);
    await expect(
      page.getByRole("option", { name: /^1 to 3 stars/ })
    ).toContainText(String(low));
    await shot(page, "comments-filter-open-stars");
    await page.getByRole("option", { name: /^4 and 5 stars/ }).click();
    await expect(comments).toContainText(`Comments ${62 - low}`);
    await expect(rows).toHaveCount(62 - low);
    await expect(
      page.getByRole("combobox", { name: "Comments for" })
    ).toHaveText("4 and 5 stars");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const day = (ago: number) =>
      new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
    expect((await download).suggestedFilename()).toBe(
      `demo-rate-the-app-answers-${day(29)}-to-${day(0)}.csv`
    );
    await expect(page.getByText("Exported 62 answers")).toBeVisible();
  });

  test("the report of a list of choices filters its comments by choice", async ({
    authenticatedPage: page,
  }) => {
    await tall(page);
    await askedBackend(page);
    await page.goto("/in_app/ask-2");
    await expect(page.getByRole("heading", { name: "Answers" })).toBeVisible();
    await expect(page.getByTestId("in-app-answer-bar")).toHaveCount(4);
    await expect(page.getByText("on average")).toHaveCount(0);
    const comments = page.getByRole("region", { name: /^Comments/ });
    await expect(comments).toContainText("Comments 44");
    await expect(comments.getByRole("listitem").first()).toContainText(
      "Search"
    );
    await expect(
      page.getByRole("radiogroup", { name: "Comments for" })
    ).toHaveCount(0);
    await whole(page, "report-choices");
    await page.getByRole("combobox", { name: "Comments for" }).click();
    await expect(page.getByRole("option")).toHaveText([
      "All comments44",
      ...CHOICES.map((c) => `${c.text}${counts(CHOICE_COMMENTS, c.id)}`),
    ]);
    await shot(page, "comments-filter-open-choices");
    await page.getByRole("option", { name: /^An ad/ }).click();
    await expect(comments).toContainText(
      `Comments ${counts(CHOICE_COMMENTS, "ad")}`
    );
    await expect(comments.getByRole("listitem")).toHaveCount(
      counts(CHOICE_COMMENTS, "ad")
    );
  });

  test("grey shapes show while things load, and go once they have", async ({
    authenticatedPage: page,
  }) => {
    await tall(page);
    const backend = await askedBackend(page);
    backend.campaigns.push({ ...live }, { ...draft });
    const list = hold(backend, /in_app_campaigns$/);

    await page.goto("/in_app");
    const table = page.getByRole("table", { name: "In-app messages" });
    await expect(table.locator('[data-slot="skeleton"]').first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible();
    await shot(page, "loading-list");
    list();
    await expect(table.getByText("Autumn sale")).toBeVisible();
    await expect(table.locator('[data-slot="skeleton"]')).toHaveCount(0);

    const opening = hold(backend, /in_app_campaigns\/draft-1$/);
    await page
      .getByRole("button", { name: "Actions for Welcome back" })
      .click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    const composer = page.getByRole("dialog", { name: "Edit in-app message" });
    await expect(composer.getByLabel("Loading in-app message")).toBeVisible();
    await shot(page, "loading-dialog");
    opening();
    await expect(
      composer.getByRole("textbox", { name: "Title", exact: true })
    ).toBeVisible();
    await expect(composer.getByLabel("Loading in-app message")).toHaveCount(0);

    const campaign = hold(backend, /in_app_campaigns\/live-1$/);
    const numbers = hold(backend, /in_app_campaigns\/live-1\/report$/);
    await page.goto("/in_app/live-1");
    await expect(page.getByLabel("Loading in-app message")).toBeVisible();
    await shot(page, "loading-report");
    campaign();
    await expect(
      page.getByRole("heading", { name: "Autumn sale" })
    ).toBeVisible();
    // The header and the message stay while the numbers are still on their way.
    const results = page.getByLabel("Loading results");
    await expect(results).toBeVisible();
    await expect(page.locator("aside")).toBeVisible();
    numbers();
    await expect(page.getByText("Click rate")).toBeVisible();
    await expect(results).toHaveCount(0);

    const answers = hold(backend, /in_app_campaigns\/ask-1\/report$/);
    await page.goto("/in_app/ask-1");
    await expect(
      page.getByRole("heading", { name: "Demo: Rate the app" })
    ).toBeVisible();
    await expect(page.getByLabel("Loading results")).toBeVisible();
    await shot(page, "loading-report-question");
    answers();
    await expect(page.getByText("Answer rate")).toBeVisible();
    await expect(
      page.getByRole("region", { name: /^Comments/ }).getByRole("listitem")
    ).toHaveCount(25);
    await expect(page.getByLabel("Loading results")).toHaveCount(0);
  });

  test("engagement settings switch in-app messages off for the project", async ({
    authenticatedPage: page,
  }) => {
    const backend = await mockBackend(page, [live]);
    await page.goto("/in_app");
    await page
      .getByLabel("Main navigation")
      .getByRole("link", { name: "Engagement Settings" })
      .click();
    await expect(page).toHaveURL(/\/engagement_settings/);
    const main = page.getByRole("main");
    await main.getByRole("switch", { name: "In-app messages" }).click();
    await main.getByLabel("Messages in one day").fill("3");
    await shot(page, "settings");
    await main.getByRole("button", { name: /Save Changes/ }).click();
    await expect(
      main.getByRole("button", { name: /Save Changes/ })
    ).toBeHidden();
    expect(backend.writes.at(-1)?.body).toEqual({
      enabled: false,
      session_cap: 10,
      day_cap: 3,
      control_group: 0,
      push_daily_cap: null,
    });
    await page.goto("/in_app");
    await expect(page.getByText(/switched off for this project/)).toBeVisible();
  });

  test("an experiment shows its groups on the report, and its step and tabs in the composer", async ({
    authenticatedPage: page,
  }) => {
    await mockBackend(page, [experimentCampaign()]);
    await page.goto("/in_app/exp-1");
    const banner = page.getByRole("status");
    await expect(banner).toContainText(
      "B does better than A: 6.5% vs 5.7% conversion rate (96% confidence) · variants beat the control by 83%."
    );
    await expect(
      banner.getByRole("button", { name: "Use B for everyone" })
    ).toBeVisible();
    await shot(page, "in-app-experiment-banner");
    // The Message panel previews any variant.
    const aside = page.locator("aside", {
      has: page.getByTestId("in-app-preview-card"),
    });
    await expect(page.getByTestId("in-app-preview-card")).toContainText(
      "Hello"
    );
    await aside.getByRole("radio", { name: "B", exact: true }).click();
    await expect(page.getByTestId("in-app-preview-card")).toContainText(
      "Sale on"
    );
    await shot(page, "in-app-report-variant-b");
    const card = page.getByRole("region", { name: "Experiment" });
    await expect(card).toContainText("Goal: checkout within 3 days");
    await expect(card.getByRole("row")).toHaveCount(5);
    await expect(card.getByRole("row").nth(1)).toContainText(
      "A · Your message"
    );
    await expect(card.getByRole("row").nth(4)).toContainText(
      "Project control group"
    );
    await expect(card.getByRole("row").nth(2)).toContainText("96%");
    await expect(
      card.getByText(
        "Variants convert 83% better than the control: about +47 conversions (99% confidence)."
      )
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Use variant B for everyone" })
    ).toBeVisible();
    if (SHOTS) await page.setViewportSize({ width: 1100, height: 900 });
    await shot(page, "experiment-report");
    await tall(page);
    await shot(page, "experiment-report-wide");

    await page.getByRole("button", { name: "Edit" }).click();
    const composer = page.getByRole("dialog", { name: "Edit in-app message" });
    const bar = composer.getByRole("radiogroup", { name: "Variant" });
    await expect(bar.getByRole("radio", { name: "A" })).toBeChecked();
    // Launched: the pills switch, nothing is added or removed.
    await expect(
      composer.getByRole("button", { name: "Add variant" })
    ).toHaveCount(0);
    await bar.getByRole("radio", { name: "B" }).click();
    await expect(composer.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Hi"
    );
    await expect(composer.getByTestId("in-app-preview-card")).toContainText(
      "Sale on"
    );
    await expect(
      composer.getByRole("button", { name: "Remove variant B" })
    ).toHaveCount(0);
    await shot(page, "message-variants");
    await composer.getByRole("button", { name: "Experiment" }).click();
    await expect(
      composer.getByRole("heading", { name: "Experiment" })
    ).toBeVisible();
    await expect(
      composer.getByRole("combobox", { name: "Control group" })
    ).toBeDisabled();
    await expect(
      composer.getByRole("button", { name: "Goal event" })
    ).toContainText("checkout");
    await expect(composer.getByText("Who gets what")).toBeVisible();
    await expect(
      composer.getByText("Control group 10% · A 45% · B 45%").first()
    ).toBeVisible();
    await shot(page, "experiment-step");

    // As a draft: add and remove are offered, and the split follows the pills.
    await composer.getByRole("button", { name: "Close" }).click();
    await page.goto("/in_app");
    await page.getByRole("button", { name: "New message" }).first().click();
    await page.getByRole("menuitem", { name: /Blank message/ }).click();
    const fresh = page.getByRole("dialog", { name: "Create in-app message" });
    await fresh.getByRole("textbox", { name: "Title" }).fill("Autumn sale");
    await fresh.getByRole("button", { name: "Add variant" }).click();
    await fresh.getByRole("textbox", { name: "Title" }).fill("Autumn sale, B");
    await expect(
      fresh
        .getByRole("radiogroup", { name: "Variant" })
        .getByRole("radio", { name: "B" })
    ).toBeChecked();
    await expect(fresh.getByText("A 50% · B 50%")).toBeVisible();
    await expect(
      fresh.getByRole("button", { name: "Remove variant B" })
    ).toBeVisible();
    await fresh
      .getByText("What people see, and what they can do with it.")
      .scrollIntoViewIfNeeded();
    await shot(page, "message-variants-draft");
  });

  test("a campaign that does not exist says so", async ({
    authenticatedPage: page,
  }) => {
    await mockBackend(page);
    await page.goto("/in_app/nope");
    await expect(
      page.getByText("This in-app message could not be found.")
    ).toBeVisible();
  });
});
