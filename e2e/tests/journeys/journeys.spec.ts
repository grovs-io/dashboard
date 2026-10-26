import { test, expect } from "../../fixtures/base-fixtures";
import type { Page } from "@playwright/test";
import { TEST_PROJECT } from "../../fixtures/test-data";
import {
  journey,
  journeyReport,
} from "../../../ee/lib/__tests__/journeyFixtures";
import type { Journey } from "../../../ee/types/journey";

const ROOT = `/api/v1/projects/${TEST_PROJECT.id}`;
const BASE = `${ROOT}/journeys`;

interface Backend {
  journeys: Journey[];
  writes: { method: string; path: string; body: unknown }[];
}

// A small stand-in for the API: it keeps what was saved, so a saved draft shows in the list.
async function mockBackend(page: Page, journeys: Journey[] = []) {
  const backend: Backend = { journeys: [...journeys], writes: [] };
  await page.route(/\/api\/v1\/projects\/[^/]+\/segments(\?.*)?$/, (route) =>
    route.fulfill({ json: { segments: [], truncated: false } })
  );
  await page.route(`**${ROOT}/links/lookup**`, (route) =>
    route.fulfill({
      json: {
        links: Array.from({ length: 30 }, (_, i) => ({
          id: i + 1,
          name: `Spring promo ${i + 1}`,
          path: `spring-${i + 1}`,
          access_path: `https://acme.sqd.link/spring-${i + 1}`,
        })),
      },
    })
  );
  await page.route(`**${ROOT}/in_app_settings`, (route) =>
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
  await page.route(`**${ROOT}/analytics/events/field-values**`, (route) => {
    const field = new URL(route.request().url()).searchParams.get("field");
    const values =
      field === "screen_name"
        ? ["Home", "Checkout"]
        : ["add_to_cart", "checkout_completed"];
    return route.fulfill({ json: { values, next_cursor: null } });
  });
  await page.route(`**${BASE}**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const [id, action] = url.pathname.slice(BASE.length + 1).split("/");
    const found = backend.journeys.find((j) => j.id === id);
    // Only list rows carry stats.
    const one = ({ stats: _stats, ...j }: Journey, status = 200) =>
      route.fulfill({ status, json: { journey: j } });
    if (method !== "GET")
      backend.writes.push({
        method,
        path: url.pathname.slice(BASE.length),
        body: (() => {
          try {
            return request.postData() ? request.postDataJSON() : null;
          } catch {
            return "multipart";
          }
        })(),
      });
    if (!id && method === "GET") {
      const status = url.searchParams.get("status");
      const rows = backend.journeys
        .filter((j) => !status || j.status === status)
        .map(({ steps: _steps, ...row }) => row);
      return route.fulfill({
        json: { journeys: rows, truncated: false, next_after: null },
      });
    }
    if (!id && method === "POST") {
      const created = journey({
        ...request.postDataJSON(),
        id: `new-${backend.journeys.length + 1}`,
      });
      backend.journeys.unshift(created);
      return one(created, 201);
    }
    if (!found)
      return route.fulfill({ status: 404, json: { error: "Not found" } });
    if (action === "images") {
      found.lock_version += 1;
      return route.fulfill({
        json: {
          url: "https://placehold.co/600x300/2A86FF/FFFFFF/png?text=Journey",
          lock_version: found.lock_version,
        },
      });
    }
    if (action === "report")
      return route.fulfill({ json: { report: journeyReport({ goal: null }) } });
    if (method === "GET") return one(found);
    if (method === "PATCH") {
      Object.assign(found, request.postDataJSON());
      found.lock_version += 1;
      return one(found);
    }
    if (action === "launch") {
      found.status = "live";
      found.launched_at ??= "2026-09-28T10:00:00.000Z";
      for (const step of Object.values(found.steps))
        if (step.type === "push" || step.type === "in_app")
          step.campaign_id ??= `c-${step.id}`;
      return one(found);
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return backend;
}

const draft = journey({ id: "draft-1", name: "Win back" });

const live = journey({
  id: "live-1",
  name: "Cart recovery",
  status: "live",
  launched_at: "2026-09-20T10:00:00.000Z",
  stats: { active: 1204, entered: 5310 },
});

test.describe("Journeys", () => {
  test("the list shows journeys, filters by status, and offers each action where it applies", async ({
    authenticatedPage: page,
  }) => {
    await mockBackend(page, [live, draft]);
    await page.goto("/journeys");
    const table = page.getByRole("table", { name: "Journeys" });
    await expect(table.getByText("Cart recovery")).toBeVisible();
    await expect(table.getByText("Win back")).toBeVisible();
    await expect(table.getByText("5,310")).toBeVisible();

    await page
      .getByRole("button", { name: "Actions for Cart recovery" })
      .click();
    for (const item of ["Open report", "Edit", "Duplicate", "Pause", "End"])
      await expect(
        page.getByRole("menuitem", { name: item, exact: true })
      ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Actions for Win back" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Live" }).click();
    await expect(table.getByText("Win back")).toHaveCount(0);
    await expect(page).toHaveURL(/status=live/);
  });

  test("builds a journey from a template, launches it, and the report shows its counts", async ({
    authenticatedPage: page,
  }) => {
    const backend = await mockBackend(page);
    await page.goto("/journeys");
    await page.getByRole("button", { name: "New journey" }).first().click();
    await page
      .getByRole("dialog", { name: "Start a journey" })
      .getByRole("button", { name: /^Blank/ })
      .click();
    const editor = page.getByRole("dialog", { name: "Create journey" });
    await expect(
      editor.getByRole("complementary", { name: "Overview" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/journeys(\?|$)/);

    await editor
      .getByRole("button", { name: "Rename Untitled journey" })
      .click();
    await editor.getByLabel("Journey name").fill("Cart recovery");
    await page.keyboard.press("Enter");
    await editor.getByRole("button", { name: "Starts when…" }).click();
    await editor
      .getByRole("button", { name: "Entry event", exact: true })
      .click();
    await page.getByRole("option", { name: "add_to_cart" }).click();

    await editor
      .getByRole("button", { name: "Add a step at the start" })
      .click();
    await page.getByRole("menuitem", { name: /^Wait/ }).click();
    await editor.getByLabel("Wait for").fill("2");
    await editor.getByRole("combobox", { name: "Unit" }).click();
    await page.getByRole("option", { name: "hours" }).click();
    await editor.getByRole("combobox", { name: "Until" }).click();
    await page.getByRole("option", { name: "Do an event" }).click();
    await editor
      .getByRole("button", { name: "Wait for event", exact: true })
      .click();
    await page.getByRole("option", { name: "checkout_completed" }).click();

    await editor
      .getByRole("button", { name: "Add a step after 1. Wait on Time ran out" })
      .click();
    await page.getByRole("menuitem", { name: /^Send push/ }).click();
    await editor.locator("#push-title").fill("Your cart misses you");
    await editor.locator("#push-body").fill("Finish your order today");
    await expect(
      editor.getByRole("button", { name: "2. Send push", exact: true })
    ).toContainText("Your cart misses you");

    await editor.getByRole("button", { name: "Launch", exact: true }).click();
    const review = page.getByRole("dialog", {
      name: "Launch “Cart recovery”?",
    });
    await expect(review).toContainText(
      "People enter when they do add_to_cart — everyone, once. They go through 2 steps and leave at the end. It starts now and runs until you end it."
    );
    await review.getByRole("button", { name: "Launch" }).click();
    await expect(page).toHaveURL(/\/journeys\/new-1$/);

    const saved = backend.writes.filter((w) => w.method === "PATCH").at(-1)!
      .body as Journey;
    expect(saved.name).toBe("Cart recovery");
    expect(saved.entry.event).toEqual({ name: "add_to_cart", filters: [] });
    expect(saved.steps.s1).toMatchObject({
      type: "wait",
      minutes: 120,
      until: { kind: "event", event: { name: "checkout_completed" } },
      timeout_next: "s2",
    });
    expect(backend.writes.map((w) => `${w.method} ${w.path}`)).toContain(
      "POST /new-1/launch"
    );
    await expect(
      page.getByRole("link", { name: "Push report" }).first()
    ).toHaveAttribute("href", "/push/c-s2");
    await expect(
      page.getByText("4,720", { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByLabel("1. Wait", { exact: true })).toContainText(
      "Reached 4,720"
    );
  });

  test("every template sends a create body that matches the contract", async ({
    authenticatedPage: page,
  }) => {
    const backend = await mockBackend(page);
    const keys = (text: string) => text.split(" ");
    const TOP = keys(
      "control_group end_at entry first_step goals name re_entry start_at steps"
    );
    const STEP: Record<string, string[]> = {
      wait: keys("id minutes next timeout_next type until"),
      push: keys(
        "body data id image_url link_id next quiet_hours sound title type"
      ),
      in_app: keys("caps content id next template triggers type valid_days"),
      set_attribute: keys("id key next type value"),
    };
    const EVENT = [
      [],
      ["system"],
      ["filters", "screen"],
      ["filters", "name"],
    ].map((k) => k.join());
    const eventOk = (e: unknown) =>
      e === null ||
      EVENT.includes(
        Object.keys(e as object)
          .sort()
          .join()
      );
    const templates = ["Blank", "Welcome series", "Cart recovery", "Win-back"];
    for (const name of templates) {
      await page.goto("/journeys");
      await page.getByRole("button", { name: "New journey" }).first().click();
      await page
        .getByRole("dialog", { name: "Start a journey" })
        .getByRole("button", { name: new RegExp(`^${name}`) })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Create journey" })
      ).toBeVisible();
      const body = backend.writes.filter((w) => w.method === "POST").at(-1)!
        .body as Journey;
      expect(Object.keys(body).sort(), name).toEqual(TOP);
      expect(Object.keys(body.entry).sort(), name).toEqual([
        "audience_segment_id",
        "event",
        "segment_id",
        "type",
      ]);
      expect(
        eventOk(body.entry.event),
        `${name} entry event ${JSON.stringify(body.entry.event)}`
      ).toBe(true);
      for (const step of Object.values(body.steps)) {
        expect(Object.keys(step).sort(), `${name} ${step.id}`).toEqual(
          STEP[step.type]
        );
        if (step.type === "wait" && step.until?.kind === "event")
          expect(eventOk(step.until.event), `${name} ${step.id} until`).toBe(
            true
          );
      }
    }
    const bodies = backend.writes
      .filter((w) => w.method === "POST")
      .map((w) => w.body as Journey);
    expect(bodies[0]!.entry.event).toEqual({});
    expect(bodies[1]!.entry.event).toEqual({ system: "install" });
    expect(bodies[2]!.goals).toEqual([
      { event: "checkout_completed", window_hours: 168 },
    ]);
    expect(bodies[3]!.entry).toEqual({
      type: "segment",
      event: null,
      segment_id: null,
      audience_segment_id: null,
    });
  });

  test("push step: image upload, a link list that scrolls inside the dialog, and New link", async ({
    authenticatedPage: page,
  }) => {
    await mockBackend(page, [draft]);
    await page.goto("/journeys");
    await page
      .getByRole("button", { name: "Open journey Win back", exact: true })
      .click();
    const editor = page.getByRole("dialog", { name: "Edit journey" });

    await editor
      .getByRole("button", { name: "2. Send push", exact: true })
      .click();
    await editor.locator('aside input[type="file"]').setInputFiles({
      name: "promo.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    await expect(editor.getByText("Uploaded image")).toBeVisible();
    await expect(editor.getByLabel("Or an image URL")).toHaveValue("");

    await editor.getByRole("combobox", { name: "Deep link" }).click();
    const list = page.locator("[cmdk-list]");
    await expect(
      page.getByRole("option", { name: /Spring promo 30/ })
    ).toBeAttached();
    await list.hover();
    await page.mouse.wheel(0, 600);
    await expect
      .poll(() => list.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(
      editor.getByRole("button", { name: "New link" })
    ).toBeVisible();
  });
});
