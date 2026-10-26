import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/queries/useAnalyticsOverviewQueries", () => ({
  useOverviewKeyMetricsQuery: vi.fn(),
  useOverviewUserTrendsQuery: vi.fn(),
}));
vi.mock("@/hooks/queries/useAnalyticsRetentionQueries", () => ({
  useRetentionSummaryQuery: vi.fn(),
}));
vi.mock("@/hooks/queries/useDashboardQueries", () => ({
  useTopLinksQuery: vi.fn(),
}));
vi.mock("@/hooks/queries/useCampaignsQueries", () => ({
  useCampaignsListQuery: vi.fn(),
}));
import {
  useOverviewKeyMetricsQuery,
  useOverviewUserTrendsQuery,
} from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import { useTopLinksQuery } from "@/hooks/queries/useDashboardQueries";
import { useCampaignsListQuery } from "@/hooks/queries/useCampaignsQueries";
import { PanelWidget } from "../PanelWidget";
import type { PanelKey, StoredFilter } from "@/types";
import type { WidgetRangeLimits } from "../widgetLayout";

// recharts' ResponsiveContainer observes its size; jsdom doesn't ship ResizeObserver.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (
      globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
    ).ResizeObserver = ResizeObserverStub;
  }
});

const base = {
  start_date: "2026-09-01",
  end_date: "2026-09-30",
  platform: "ios",
};
const limits: WidgetRangeLimits = { rangeSpanDays: 29 };
const metrics = {
  views: 0,
  link_views: 40,
  installs: 12,
  link_driven_installs: 6,
  organic_installs: 4,
  referred_users: 2,
  reinstalls: 0,
  app_opens: 30,
  returning_users: 5,
  returning_rate: 0.2,
  arpu: 150,
  arppu: 300,
  units_sold: 3,
  first_time_purchases: 2,
  cancellations: 1,
  revenue: 900,
};
const done = (data: unknown) => ({
  data,
  isLoading: false,
  isFetching: false,
  error: null,
});

const renderPanel = (
  panel: PanelKey,
  props: Partial<{
    revenueEnabled: boolean;
    limits: typeof limits;
    filters: StoredFilter[];
  }> = {}
) =>
  render(
    <PanelWidget
      projectId="p1"
      panel={panel}
      base={base}
      pageFilters={[]}
      filters={props.filters ?? []}
      limits={props.limits ?? limits}
      revenueEnabled={props.revenueEnabled ?? true}
      granularity="week"
    />
  );

describe("PanelWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOverviewKeyMetricsQuery).mockReturnValue(
      done({ metrics }) as never
    );
    vi.mocked(useRetentionSummaryQuery).mockReturnValue(
      done({
        day_1: 40,
        day_7: 20,
        day_30: 10,
        median_churn_day: 3,
        sparkline: [],
      }) as never
    );
    vi.mocked(useTopLinksQuery).mockReturnValue(
      done([
        { id: "l1", name: "Spring promo", views: 9, revenue_cents: 0 },
      ]) as never
    );
    vi.mocked(useCampaignsListQuery).mockReturnValue(
      done({
        data: [{ id: 7, name: "Launch", total_views: 11, total_revenue: 0 }],
      }) as never
    );
    vi.mocked(useOverviewUserTrendsQuery).mockReturnValue(
      done({
        points: [
          { date: "2026-09-01", new_users: 4, previous_new_users: 2 },
          { date: "2026-09-08", new_users: 6, previous_new_users: 3 },
        ],
      }) as never
    );
  });

  it("user_trends reads the user trends once with merged filters and the page granularity", () => {
    const { container } = renderPanel("user_trends", {
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    expect(useOverviewUserTrendsQuery).toHaveBeenCalledTimes(1);
    expect(useOverviewUserTrendsQuery).toHaveBeenCalledWith(
      "p1",
      {
        ...base,
        filters: JSON.stringify([
          { field: "country", operator: "is", value: "RO" },
        ]),
        granularity: "week",
      },
      true
    );
    expect(container.querySelector('[data-slot="chart"]')).toHaveClass(
      "h-[200px]"
    );
    expect(useOverviewKeyMetricsQuery).not.toHaveBeenCalled();
  });

  it("user_trends shows the empty text when there are no points", () => {
    vi.mocked(useOverviewUserTrendsQuery).mockReturnValue(
      done({ points: [] }) as never
    );
    renderPanel("user_trends");
    expect(
      screen.getByText("No new users in this date range.")
    ).toBeInTheDocument();
  });

  it("user_trends judges the cold check on the previous period", () => {
    const retention = {
      plan: "paid" as const,
      queryable_days: 3650,
      cold_after_days: 60,
      can_query_cold: true,
    };
    const day = 86_400_000;
    const now = Date.now();
    renderPanel("user_trends", {
      limits: {
        rangeSpanDays: 30,
        retention,
        from: new Date(now - 30 * day),
        prevFrom: new Date(now - 61 * day),
      },
      filters: [{ field: "event_name", operator: "contains", value: "buy" }],
    });
    expect(useOverviewUserTrendsQuery).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      false
    );
    expect(screen.getByText(/can't reach older data/)).toBeInTheDocument();
  });

  it("acquisition_channels reads key metrics once with merged filters and renders the channels", () => {
    renderPanel("acquisition_channels", {
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    expect(useOverviewKeyMetricsQuery).toHaveBeenCalledTimes(1);
    expect(useOverviewKeyMetricsQuery).toHaveBeenCalledWith(
      "p1",
      {
        ...base,
        filters: JSON.stringify([
          { field: "country", operator: "is", value: "RO" },
        ]),
      },
      true
    );
    expect(screen.getByText("Channels")).toBeInTheDocument();
    expect(screen.getByText("Link-driven")).toBeInTheDocument();
    expect(useRetentionSummaryQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["acquisition", "Link views"],
    ["engagement", "App opens"],
    ["revenue", "Units sold"],
  ] as const)("%s renders its metric group from key metrics", (panel, row) => {
    renderPanel(panel);
    expect(useOverviewKeyMetricsQuery).toHaveBeenCalledTimes(1);
    expect(screen.getByText(row)).toBeInTheDocument();
  });

  it("retention reads the retention summary with date and platform only", () => {
    renderPanel("retention", {
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    expect(useRetentionSummaryQuery).toHaveBeenCalledTimes(1);
    expect(useRetentionSummaryQuery).toHaveBeenCalledWith(
      "p1",
      { start_date: "2026-09-01", end_date: "2026-09-30", platform: "ios" },
      true
    );
    expect(useOverviewKeyMetricsQuery).not.toHaveBeenCalled();
    expect(screen.getByText("Day 7")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("retention shows each rate's user count and explains a missing rate", () => {
    vi.mocked(useRetentionSummaryQuery).mockReturnValue(
      done({
        day_1: 40,
        day_7: 20,
        day_30: null,
        day_1_users: 1200,
        day_7_users: 1,
        day_30_users: 0,
        median_churn_day: 3,
        sparkline: [],
      }) as never
    );
    renderPanel("retention");
    expect(screen.getByText("1.200 users")).toBeInTheDocument();
    expect(screen.getByText("1 user")).toBeInTheDocument();
    expect(screen.getByText("Day 30").parentElement).toHaveAttribute(
      "title",
      "No users reached day 30 in this range."
    );
  });

  it("top_links reads top links for the day range and platform", () => {
    renderPanel("top_links");
    expect(useTopLinksQuery).toHaveBeenCalledTimes(1);
    expect(useTopLinksQuery).toHaveBeenCalledWith("p1", {
      start_date: "2026-09-01 00:00:00",
      end_date: "2026-09-30 23:59:59",
      platform: "ios",
    });
    expect(screen.getByText("Spring promo")).toBeInTheDocument();
  });

  it("top_campaigns reads the campaign list", () => {
    renderPanel("top_campaigns");
    expect(useCampaignsListQuery).toHaveBeenCalledTimes(1);
    expect(useCampaignsListQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        per_page: 5,
        sort_by: "views",
        start_date: "2026-09-01 00:00:00",
        end_date: "2026-09-30 23:59:59",
        platform: "ios",
      })
    );
    expect(screen.getByText("Launch")).toBeInTheDocument();
  });

  it("revenue shows its empty state when revenue is not collected", () => {
    renderPanel("revenue", { revenueEnabled: false });
    expect(screen.getByText("Revenue isn't tracked")).toBeInTheDocument();
    expect(screen.queryByText("Units sold")).toBeNull();
    expect(useOverviewKeyMetricsQuery).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      false
    );
  });

  it("holds key-metrics panels that would exceed the raw cap", () => {
    renderPanel("engagement", {
      limits: { rangeSpanDays: 120 },
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    expect(useOverviewKeyMetricsQuery).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      false
    );
    expect(screen.getByText(/limited to 90 days/)).toBeInTheDocument();
  });
});
