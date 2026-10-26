import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/queries/useAnalyticsOverviewQueries", () => ({
  useOverviewKeyMetricsQuery: vi.fn(),
  useOverviewUserTrendsQuery: vi.fn(),
  useOverviewKeyMetricSeriesQuery: vi.fn(),
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
vi.mock("../KpiRowPanel", () => ({
  KpiRowPanel: (p: { panel: string; prevParams?: { start_date: string } }) => (
    <div>
      kpis:{p.panel}:{p.prevParams?.start_date}
    </div>
  ),
}));
vi.mock("@/components/analytics/overview/TrendAreaChart", () => ({
  TrendAreaChart: (p: { data: unknown; money?: boolean }) => (
    <pre data-testid="chart">{JSON.stringify({ ...p })}</pre>
  ),
}));
import { useOverviewKeyMetricSeriesQuery } from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useTopLinksQuery } from "@/hooks/queries/useDashboardQueries";
import { useCampaignsListQuery } from "@/hooks/queries/useCampaignsQueries";
import { PanelWidget } from "../PanelWidget";
import type { PanelKey, StoredFilter } from "@/types";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  }
});

const base = { start_date: "2026-10-01", end_date: "2026-10-14" };
const done = (data: unknown) => ({
  data,
  isLoading: false,
  isFetching: false,
  error: null,
});
const renderPanel = (
  panel: PanelKey,
  onRowClick?: (t: unknown) => void,
  limits = { rangeSpanDays: 13 },
  filters: StoredFilter[] = []
) =>
  render(
    <PanelWidget
      projectId="p1"
      panel={panel}
      base={base}
      pageFilters={[]}
      filters={filters}
      limits={limits}
      revenueEnabled={false}
      granularity="day"
      onRowClick={onRowClick}
    />
  );

describe("built-in panels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gives a KPI row the previous equal-length period", () => {
    renderPanel("kpis_acquisition");
    expect(screen.getByText("kpis:kpis_acquisition:2026-09-17")).toBeTruthy();
  });

  it("doesn't block KPI rows on long ranges: they read rollups", () => {
    renderPanel("kpis_acquisition", undefined, { rangeSpanDays: 181 });
    expect(screen.getByText(/^kpis:kpis_acquisition:/)).toBeTruthy();
  });

  it("charts revenue in dollars against the previous period", () => {
    vi.mocked(useOverviewKeyMetricSeriesQuery).mockImplementation(
      (_p, params) =>
        done({
          metric: "revenue",
          points:
            params?.start_date === base.start_date
              ? [
                  { date: "2026-10-01", value: 1250 },
                  { date: "2026-10-02", value: 0 },
                ]
              : [
                  { date: "2026-09-17", value: 500 },
                  { date: "2026-09-18", value: 100 },
                ],
        }) as never
    );
    renderPanel("revenue_trend");
    expect(useOverviewKeyMetricSeriesQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "revenue", granularity: "day" })
    );
    const props = JSON.parse(screen.getByTestId("chart").textContent!);
    expect(props.money).toBe(true);
    expect(props.data).toEqual([
      { date: "2026-10-01", value: 12.5, previous: 5 },
      { date: "2026-10-02", value: 0, previous: 1 },
    ]);
  });

  it("blocks revenue on filters other than platform without querying", () => {
    vi.mocked(useOverviewKeyMetricSeriesQuery).mockReturnValue(
      done(undefined) as never
    );
    renderPanel("revenue_trend", undefined, undefined, [
      { field: "country", operator: "is", value: "RO" },
    ]);
    expect(
      screen.getByText("Revenue can't be filtered by these filters.")
    ).toBeTruthy();
    expect(useOverviewKeyMetricSeriesQuery).toHaveBeenCalledWith(
      "p1",
      undefined
    );
  });

  it("keeps the revenue chart for a platform filter", () => {
    vi.mocked(useOverviewKeyMetricSeriesQuery).mockReturnValue(
      done({
        metric: "revenue",
        points: [{ date: "2026-10-01", value: 100 }],
      }) as never
    );
    renderPanel("revenue_trend", undefined, undefined, [
      { field: "platform", operator: "is", value: "ios" },
    ]);
    expect(screen.getByTestId("chart")).toBeTruthy();
  });

  it("shows the unsupported state when the series says so", () => {
    vi.mocked(useOverviewKeyMetricSeriesQuery).mockReturnValue(
      done({ metric: "revenue", points: [], unsupported: true }) as never
    );
    renderPanel("revenue_trend");
    expect(
      screen.getByText("Revenue can't be filtered by these filters.")
    ).toBeTruthy();
    expect(screen.queryByTestId("chart")).toBeNull();
  });

  it("shows the analytics error when the revenue series fails", () => {
    vi.mocked(useOverviewKeyMetricSeriesQuery).mockReturnValue({
      ...done(undefined),
      error: new Error("boom"),
    } as never);
    renderPanel("revenue_trend");
    expect(screen.queryByTestId("chart")).toBeNull();
  });

  it("opens a top link in the link dialog and a top campaign on its page", async () => {
    vi.mocked(useTopLinksQuery).mockReturnValue(
      done([{ id: "7", name: "Promo", views: 10 }]) as never
    );
    vi.mocked(useCampaignsListQuery).mockReturnValue(
      done({ data: [{ id: "3", name: "Summer", total_views: 4 }] }) as never
    );
    const onRowClick = vi.fn();
    renderPanel("top_links", onRowClick);
    await userEvent.click(screen.getByRole("button", { name: /promo/i }));
    expect(onRowClick).toHaveBeenCalledWith({ kind: "link", id: "7" });
    renderPanel("top_campaigns", onRowClick);
    await userEvent.click(screen.getByRole("button", { name: /summer/i }));
    expect(onRowClick).toHaveBeenCalledWith({ kind: "campaign", id: "3" });
  });
});
