import type { Page } from "@playwright/test";
import {
  TEST_USER,
  TEST_INSTANCE,
  TEST_PROJECT,
  TEST_LINK,
  TEST_CAMPAIGN,
  TEST_SUBSCRIPTION,
  TEST_METRICS_OVERVIEW,
  MOCK_TOKENS,
} from "./test-data";

/**
 * Sets up route-level API mocking for all /api/v1/** endpoints.
 * Call this in beforeEach or in a fixture to mock the API layer.
 */
export async function setupApiMocks(page: Page) {
  // Register catch-all first so later, specific route mocks take precedence.
  await page.route("**/api/v1/**", async (route) => {
    console.warn(
      `Unhandled API route: ${route.request().method()} ${route.request().url()}`
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Auth endpoints. The app posts to the BFF routes under /api/auth/*; the upstream
  // /oauth/* call happens server-side where page.route cannot intercept it.
  const loginResponse = {
    ...MOCK_TOKENS,
    user: {
      id: TEST_USER.id,
      email: TEST_USER.email,
      name: TEST_USER.name,
      roles: [{ instance_id: TEST_INSTANCE.id, role: "admin" }],
      otp_required_for_login: false,
    },
  };

  await page.route("**/api/auth/token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(loginResponse),
    });
  });

  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TOKENS),
    });
  });

  await page.route("**/api/auth/revoke", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.route("**/oauth/token", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TOKENS),
      });
    }
  });

  const currentUserResponse = {
    user: {
      id: TEST_USER.id,
      email: TEST_USER.email,
      name: TEST_USER.name,
      roles: [{ instance_id: TEST_INSTANCE.id, role: "admin" }],
      otp_required_for_login: false,
    },
  };

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentUserResponse),
    });
  });

  await page.route("**/api/v1/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentUserResponse),
    });
  });

  // Instances
  await page.route("**/api/v1/instances", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          instances: [
            {
              ...TEST_INSTANCE,
              projects: [TEST_PROJECT],
            },
          ],
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          instance: TEST_INSTANCE,
        }),
      });
    }
  });

  // Instance details
  await page.route(`**/api/v1/instances/${TEST_INSTANCE.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...TEST_INSTANCE,
        projects: [TEST_PROJECT],
        get_started_setup: null,
      }),
    });
  });

  // Instance members
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/members`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          members: [
            {
              user: {
                id: TEST_USER.id,
                name: TEST_USER.name,
                email: TEST_USER.email,
              },
              role: "admin",
            },
          ],
        }),
      });
    }
  );

  // Instance role
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/role`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: "admin" }),
      });
    }
  );

  // Project configuration
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/configurations`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configurations: [
            {
              platform: "ios",
              app_id: null,
              bundle_id: null,
              team_id: null,
            },
            {
              platform: "android",
              package_name: null,
              sha256: null,
            },
          ],
        }),
      });
    }
  );

  // Links
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/links*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          links: [TEST_LINK],
          total_pages: 1,
          total_entries: 1,
        }),
      });
    }
  );

  // Campaigns
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/campaigns*`,
    async (route) => {
      const campaigns = Object.assign([TEST_CAMPAIGN], {
        total_pages: 1,
        total_entries: 1,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(campaigns),
      });
    }
  );

  // Dashboard metrics
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/events/overview*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          metrics_values: {
            link_views: 150,
            link_driven_installs: 45,
            organic_users: 80,
            installs: 55,
            app_opens: 200,
          },
        }),
      });
    }
  );

  // Top links
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/events/top_links*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          top_links: [{ link: TEST_LINK, views: 42 }],
        }),
      });
    }
  );

  // Links views (chart data)
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/events/search*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ events: [] }),
      });
    }
  );

  // Subscription
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/subscription`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ subscription: TEST_SUBSCRIPTION }),
      });
    }
  );

  // MAU
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/mau`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          current_quantity: 500,
          total_available: 10000,
        }),
      });
    }
  );

  // Notifications
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/notifications*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          notifications: [],
          total_pages: 0,
          total_entries: 0,
        }),
      });
    }
  );

  // Visitors
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/visitors*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          visitors: [],
          total_pages: 0,
          total_entries: 0,
        }),
      });
    }
  );

  // Redirect config
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/redirect_config`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          redirect_config: {
            // must be set, otherwise the create link/campaign dialogs are
            // replaced by the "redirect rules required" gate
            default_fallback: "https://test.grovs.io",
            show_preview_android: false,
            show_preview_ios: false,
          },
        }),
      });
    }
  );

  // Domain config
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/domain`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          domain: {
            id: "domain-001",
            subdomain: "test",
            domain: "grovs.io",
          },
        }),
      });
    }
  );

  // Events for payment screen
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/events*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          metrics_values: {
            active_users: 100,
          },
        }),
      });
    }
  );

  // Purchases/revenue
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/purchases*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          purchases: [],
          total_pages: 0,
          total_entries: 0,
        }),
      });
    }
  );

  // Setup progress
  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/setup_progress*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          steps: [],
        }),
      });
    }
  );

  // --- endpoints the api moved to; the older paths above no longer match ---

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/links/**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          links: [TEST_LINK],
          meta: { total_pages: 1, total_entries: 1 },
        }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/links/random_path`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ valid_path: "random-path" }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/campaigns/**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [TEST_CAMPAIGN],
          total_pages: 1,
          total_entries: 1,
        }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/notifications/**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], total_pages: 0, total_entries: 0 }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/custom_domain`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          custom_domain: null,
          tls_mode: "cloudflare",
          ingress_host: null,
        }),
      });
    }
  );

  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/billing/**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    }
  );

  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/billing/subscription`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(TEST_SUBSCRIPTION),
      });
    }
  );

  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/billing/mau`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ current_quantity: 500, total_available: 10000 }),
      });
    }
  );

  await page.route(
    `**/api/v1/instances/${TEST_INSTANCE.id}/events/billing`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        // the query returns metrics_values directly; undefined trips tanstack
        body: JSON.stringify({ metrics_values: [] }),
      });
    }
  );

  // Analytics overview (the dashboard)
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/dashboard/**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metrics: {}, links: [] }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/dashboard/top_links`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ links: [TEST_LINK] }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/dashboard/links_views`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          metrics: { "2026-07-15": 10, "2026-07-16": 25, "2026-07-17": 40 },
        }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/dashboard/metrics_overview`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metrics: TEST_METRICS_OVERVIEW }),
      });
    }
  );

  // Analytics overview key metrics (current + previous range use the same mock)
  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/analytics/overview/key-metrics*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metrics: TEST_METRICS_OVERVIEW.current }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/analytics/overview/key-metrics/series*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ points: [] }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/analytics/overview/trends/users*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          points: [
            { date: "2026-07-15", new_users: 10, previous_new_users: 8 },
            { date: "2026-07-16", new_users: 25, previous_new_users: 12 },
            { date: "2026-07-17", new_users: 40, previous_new_users: 20 },
          ],
        }),
      });
    }
  );

  await page.route(
    `**/api/v1/projects/${TEST_PROJECT.id}/analytics/retention/summary*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          day_1: 0.4,
          day_7: 0.2,
          day_30: 0.1,
          sparkline: [],
          median_churn_day: null,
        }),
      });
    }
  );
}
