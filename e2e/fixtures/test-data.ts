export const TEST_USER = {
  email: "test@example.com",
  password: "TestPass123!",
  name: "Test User",
  id: "user-test-id-001",
};

export const TEST_PROJECT = {
  id: "proj-test-001",
  name: "Test Project",
  domain: "test.grovs.io",
  environment: "production",
};

export const TEST_INSTANCE = {
  id: "inst-test-001",
  name: "Test Project",
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  revenue_collection_enabled: false,
  get_started_dismissed: true,
  api_key: "test-api-key",
  hash_id: "test-hash-id",
  uri_scheme: "grovs-test",
  production: TEST_PROJECT,
  test: {
    ...TEST_PROJECT,
    id: "proj-test-002",
    name: "test",
    environment: "test",
  },
  projects: [TEST_PROJECT],
};

export const TEST_LINK = {
  id: "link-test-001",
  name: "Test Link",
  path: "test-link",
  url: "https://test.grovs.io/test-link",
  views: 42,
  installs: 10,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived: false,
  ads_platform: "quick_link",
  tags: ["promo"],
};

export const TEST_CAMPAIGN = {
  id: "camp-test-001",
  name: "Test Campaign",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived: false,
};

export const TEST_SUBSCRIPTION = {
  id: "sub-test-001",
  plan_name: "Growth",
  status: "active",
  type: "stripe",
  current_maus: 500,
  total_maus: 10000,
  maus: 500,
  // PlanSection reads stripe_subscription.current_period_start; without it the
  // settings page throws into its error boundary.
  stripe_subscription: {
    current_period_start: 1_780_000_000,
    current_period_end: 1_782_600_000,
  },
  quantity_for_current_billing_cycle: 500,
  amount_cents: 4900,
  start_at: "2026-07-01T00:00:00.000Z",
  end_at: "2026-08-01T00:00:00.000Z",
};

const metricValues = {
  link_views: 150,
  link_driven_installs: 42,
  organic_users: 88,
  installs: 130,
  app_opens: 310,
  new_users: 64,
  returning_users: 96,
  returning_rate: 0.6,
  referred_users: 12,
  revenue: 0,
  arpu: 0,
  arppu: 0,
  units_sold: 0,
  cancellations: 0,
  first_time_purchases: 0,
};

export const TEST_METRICS_OVERVIEW = {
  current: metricValues,
  previous: { ...metricValues, link_views: 120 },
};

const widgetMeta = {
  dashboard_id: 1,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

export const TEST_METRIC_WIDGET = {
  ...widgetMeta,
  id: 11,
  position: 0,
  title: "Installs by country",
  kind: "metric",
  panel: null,
  viz: "bar",
  size: "md",
  query: { metric: "installs", group_by: "country", limit: 10 },
  filters: [],
};

export const TEST_PANEL_WIDGET = {
  ...widgetMeta,
  id: 12,
  position: 1,
  title: "Retention",
  kind: "panel",
  panel: "retention",
  viz: "bar",
  size: "sm",
  query: {},
  filters: [],
};

export const TEST_DASHBOARD = {
  id: 1,
  name: "Growth",
  position: 0,
  widgets: [TEST_METRIC_WIDGET, TEST_PANEL_WIDGET],
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

export const TEST_METRIC_QUERY = {
  metric: "installs",
  group_by: "country",
  rows: [
    { key: "RO", label: "RO", value: 40, previous: 30 },
    { key: "DE", label: "DE", value: 25, previous: 20 },
    { key: "US", label: "US", value: 10, previous: 12 },
  ],
  other: { key: "__other__", label: "Other", value: 5, previous: 4 },
  total: { value: 80, previous: 66 },
};

const smartBannerBase = {
  status: "live",
  platforms: ["ios", "android"],
  url_include: [],
  url_exclude: [],
  position: "top",
  subtitle: null,
  button_text: "Open",
  background_color: "#FFFFFF",
  text_color: "#111827",
  button_color: "#2563EB",
  button_text_color: "#FFFFFF",
  icon_url: null,
  dismiss_days: 7,
  open_hide_days: 30,
  default_link: "https://test.grovs.io/sb-default",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  stats: {
    views: 120,
    clicks: 30,
    dismisses: 4,
    ctr: 0.25,
    opens: 20,
    installs: 5,
  },
};

export const TEST_SMART_BANNERS = [
  {
    ...smartBannerBase,
    id: 1,
    name: "Products",
    priority: 0,
    title: "Shop in the app",
  },
  {
    ...smartBannerBase,
    id: 2,
    name: "Blog",
    priority: 1,
    title: "Read in the app",
  },
];

export const MOCK_TOKENS = {
  access_token: "mock-access-token-for-testing",
  refresh_token: "mock-refresh-token-for-testing",
  token_type: "Bearer",
  expires_in: 7200,
};
