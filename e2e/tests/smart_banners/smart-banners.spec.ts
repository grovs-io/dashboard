import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/base-fixtures";
import { TEST_PROJECT, TEST_SMART_BANNERS } from "../../fixtures/test-data";

type Banner = Omit<(typeof TEST_SMART_BANNERS)[number], "status"> & {
  status: string;
};

// In-memory backend for the smart banner endpoints.
async function mockSmartBanners(page: Page) {
  let banners: Banner[] = TEST_SMART_BANNERS.map((b) => ({ ...b }));
  let nextId = 3;
  const reorderCalls: number[][] = [];
  const base = `**/api/v1/projects/${TEST_PROJECT.id}/smart_banners`;
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  // Multipart fields, read from the raw body.
  const field = (body: string, name: string) =>
    body.match(
      new RegExp(`name="smart_banner\\[${name}\\]"\\r\\n\\r\\n([^\\r]*)`)
    )?.[1];

  await page.route(base, async (route) => {
    const req = route.request();
    if (req.method() === "GET")
      return route.fulfill(json({ smart_banners: banners }));
    const body = req.postData() ?? "";
    const created: Banner = {
      ...banners[0],
      id: nextId++,
      priority: banners.length,
      name: field(body, "name") ?? "",
      title: field(body, "title") ?? "",
      status: field(body, "status") ?? "draft",
    };
    banners = [...banners, created];
    return route.fulfill(json({ smart_banner: created }, 201));
  });

  await page.route(`${base}/reorder`, async (route) => {
    const { ids } = route.request().postDataJSON() as { ids: number[] };
    reorderCalls.push(ids);
    const archived = banners.filter((b) => !ids.includes(b.id));
    banners = [
      ...ids.map((id, i) => ({
        ...banners.find((b) => b.id === id)!,
        priority: i,
      })),
      ...archived,
    ];
    return route.fulfill(json({ smart_banners: banners }));
  });

  await page.route(
    new RegExp(
      `/api/v1/projects/${TEST_PROJECT.id}/smart_banners/(\\d+)/duplicate$`
    ),
    async (route) => {
      const id = Number(
        route
          .request()
          .url()
          .match(/(\d+)\/duplicate$/)![1]
      );
      const source = banners.find((b) => b.id === id)!;
      const copy: Banner = {
        ...source,
        id: nextId++,
        name: `${source.name} (copy)`,
        status: "draft",
      };
      banners = [...banners, copy];
      return route.fulfill(json({ smart_banner: copy }, 201));
    }
  );

  await page.route(
    new RegExp(`/api/v1/projects/${TEST_PROJECT.id}/smart_banners/(\\d+)$`),
    async (route) => {
      const req = route.request();
      const id = Number(req.url().match(/(\d+)$/)![1]);
      if (req.method() === "PATCH") {
        const body = req.postData() ?? "";
        const status = field(body, "status");
        const name = field(body, "name");
        banners = banners.map((b) =>
          b.id === id
            ? {
                ...b,
                ...(status && { status }),
                ...(name !== undefined && { name }),
              }
            : b
        );
      }
      return route.fulfill(
        json({ smart_banner: banners.find((b) => b.id === id) })
      );
    }
  );

  await page.route(`${base}/status`, (route) =>
    route.fulfill(
      json({
        web_configured: true,
        domains: ["shop.test"],
        sdk_last_seen_at: new Date(Date.now() - 60_000).toISOString(),
      })
    )
  );

  return { reorderCalls, current: () => banners };
}

const priorities = (page: Page) =>
  page.getByTestId("smart-banner-priority").allTextContents();

test.describe("Smart Banners", () => {
  test("creates in a dialog, sets priority and runs the lifecycle", async ({
    authenticatedPage: page,
  }) => {
    const api = await mockSmartBanners(page);

    await page.goto("/smart_banners");
    const rows = page.getByTestId("smart-banner-row");
    await expect(rows).toHaveCount(2, { timeout: 10_000 });
    await expect(rows.nth(0)).toContainText("Products");
    await expect(
      page.getByRole("columnheader", { name: "Priority" })
    ).toBeVisible();
    await expect.poll(() => priorities(page)).toEqual(["1", "2"]);
    await expect(
      rows.nth(0).locator("td").nth(1).locator("img, svg")
    ).toHaveCount(0);
    await expect(
      page.getByText(/the one with the highest priority is shown/)
    ).toBeVisible();
    await expect(page.getByText("Web SDK connected")).toHaveCount(0);

    // Search narrows the rows and locks reordering until cleared.
    const search = page.getByPlaceholder("Search banner");
    await search.fill("blog");
    await expect(rows).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Reorder Blog" })
    ).toBeDisabled();
    await page.getByRole("button", { name: "Actions for Blog" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Move to top" })
    ).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
    await search.fill("");
    await expect(rows).toHaveCount(2);

    // Create in the dialog over the list, and publish.
    await page.getByRole("button", { name: "New banner" }).click();
    const dialog = page.getByRole("dialog", { name: "Create smart banner" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/smart_banners\?(.*&)?banner=new(&|$)/);
    await dialog.getByLabel("Name", { exact: true }).fill("Sale");
    await dialog
      .getByRole("navigation", { name: "Banner sections" })
      .getByRole("button", { name: /Content/ })
      .click();
    await dialog.getByLabel("Title", { exact: true }).fill("Sale in the app");
    await expect(dialog.getByTestId("smart-banner-preview")).toContainText(
      "Sale in the app"
    );
    await dialog
      .getByRole("radiogroup", { name: "Preview on" })
      .getByRole("radio", { name: "Android" })
      .click();
    await expect(dialog.getByTestId("smart-banner-phone")).toHaveAttribute(
      "data-platform",
      "android"
    );
    await expect(dialog.getByTestId("browser-chrome")).toContainText(
      "shop.test"
    );
    await dialog.getByRole("button", { name: "Publish" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/banner=/);
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(2)).toContainText("Sale");
    expect(api.current().find((b) => b.name === "Sale")?.status).toBe("live");

    // Reorder with the keyboard: move "Products" below "Blog".
    const reorderButton = page.getByRole("button", {
      name: "Reorder Products",
    });
    // dnd-kit's live region (id starts "DndLiveRegion") is a more reliable sync point than a fixed delay.
    const dndLiveRegion = page.locator('[id^="DndLiveRegion"]');
    await reorderButton.focus();
    await page.keyboard.press("Space");
    await expect(reorderButton).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowDown");
    await expect(dndLiveRegion).toContainText("moved over droppable area Blog");
    await page.keyboard.press("Space");
    await expect(reorderButton).not.toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => api.reorderCalls.at(-1)).toEqual([2, 1, 3]);
    await expect(rows.nth(0)).toContainText("Blog");

    // Move to top from the row menu.
    await page.getByRole("button", { name: "Actions for Sale" }).click();
    await page.getByRole("menuitem", { name: "Move to top" }).click();
    await expect.poll(() => api.reorderCalls.at(-1)).toEqual([3, 2, 1]);
    await expect(rows.nth(0)).toContainText("Sale");

    // Pause from the row menu, then archive from the status pill.
    await page.getByRole("button", { name: "Actions for Blog" }).click();
    await page.getByRole("menuitem", { name: "Pause" }).click();
    await expect
      .poll(() => api.current().find((b) => b.id === 2)?.status)
      .toBe("paused");
    await page.getByRole("button", { name: "Status of Blog: Paused" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page
      .getByRole("dialog", { name: "Archive Blog?" })
      .getByRole("button", { name: "Archive" })
      .click();
    await expect
      .poll(() => api.current().find((b) => b.id === 2)?.status)
      .toBe("archived");
    await expect(rows).toHaveCount(2);
    await expect.poll(() => priorities(page)).toEqual(["1", "2"]);

    // The Archived view has no priority.
    await page.getByRole("button", { name: "Status: All" }).click();
    await page.getByRole("checkbox", { name: "Archived" }).click();
    await page.keyboard.press("Escape");
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText("Blog");
    await expect(
      page.getByRole("columnheader", { name: "Priority" })
    ).toHaveCount(0);

    // Duplicate opens the copy in the edit dialog.
    await page.getByRole("button", { name: "Actions for Blog" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    const edit = page.getByRole("dialog", { name: "Edit smart banner" });
    await expect(edit).toBeVisible();
    await expect(edit.getByLabel("Name", { exact: true })).toHaveValue(
      "Blog (copy)"
    );
    await expect(
      edit.getByRole("button", { name: "Save draft" })
    ).toBeVisible();
  });

  test("opens the editor from a deep link and confirms before discarding", async ({
    authenticatedPage: page,
  }) => {
    await mockSmartBanners(page);

    await page.goto("/smart_banners/2");
    await expect(page).toHaveURL(/\/smart_banners\?(.*&)?banner=2(&|$)/, {
      timeout: 10_000,
    });
    const dialog = page.getByRole("dialog", { name: "Edit smart banner" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("smart-banner-row")).toHaveCount(2);
    const name = dialog.getByLabel("Name", { exact: true });
    await expect(name).toHaveValue("Blog");
    await expect(
      dialog.getByRole("button", { name: "Save", exact: true })
    ).toBeVisible();
    await name.fill("Blog posts");
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByText("Close without saving?")).toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/banner=/);

    await page.goto("/smart_banners/new");
    await expect(
      page.getByRole("dialog", { name: "Create smart banner" })
    ).toBeVisible({ timeout: 10_000 });
  });
});
