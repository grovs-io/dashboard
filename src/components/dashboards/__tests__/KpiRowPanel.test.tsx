import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/queries/useAnalyticsOverviewQueries", () => ({
  useOverviewKeyMetricsQuery: vi.fn(),
}));
vi.mock("@/hooks/queries/useAnalyticsRetentionQueries", () => ({
  useRetentionSummaryQuery: vi.fn(),
}));
import { useOverviewKeyMetricsQuery } from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import {
  KpiRowPanel,
  formatKpi,
  viewToInstall,
  type KpiPanelKey,
} from "../KpiRowPanel";
import type { OverviewKeyMetrics } from "@/types";

const metrics = (
  over: Partial<OverviewKeyMetrics> = {}
): OverviewKeyMetrics => ({
  views: 0,
  link_views: 2000,
  opens: 300,
  installs: 900,
  link_driven_installs: 106,
  organic_installs: 794,
  reinstalls: 0,
  app_opens: 4000,
  total_users: 0,
  new_users: 1200,
  returning_users: 600,
  returning_rate: 0.382,
  referred_users: 40,
  revenue: 1824000,
  units_sold: 1912,
  cancellations: 0,
  first_time_purchases: 824,
  arpu: 146,
  arppu: 2210,
  ...over,
});

const base = { start_date: "2026-10-01", end_date: "2026-10-14" };
const prev = { start_date: "2026-09-17", end_date: "2026-09-30" };

function mockKm(
  cur: OverviewKeyMetrics | undefined,
  previous?: OverviewKeyMetrics,
  unsupported: string[] = []
) {
  vi.mocked(useOverviewKeyMetricsQuery).mockImplementation(
    (_p, params) =>
      ({
        data:
          params === prev
            ? previous && { metrics: previous }
            : cur && { metrics: cur, unsupported_metrics: unsupported },
        isFetching: false,
      }) as never
  );
}

const renderRow = (panel: KpiPanelKey) =>
  render(
    <KpiRowPanel
      projectId="p1"
      panel={panel}
      params={base}
      prevParams={prev}
      enabled
    />
  );

const tile = (label: string) => screen.getByText(label).parentElement!;

describe("view → install", () => {
  it("divides link-driven installs by link views", () => {
    expect(viewToInstall({ link_views: 2000, link_driven_installs: 106 })).toBe(
      0.053
    );
    expect(formatKpi("ratio", 0.053)).toBe("5.3%");
  });

  it("is blank with no views", () => {
    expect(
      viewToInstall({ link_views: 0, link_driven_installs: 5 })
    ).toBeNull();
    expect(formatKpi("ratio", null)).toBe("—");
  });
});

describe("KpiRowPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRetentionSummaryQuery).mockReturnValue({
      data: undefined,
      isFetching: false,
    } as never);
  });

  it("renders the acquisition tiles with the conversion in blue", () => {
    mockKm(metrics(), metrics({ new_users: 1000 }));
    renderRow("kpis_acquisition");
    expect(
      screen
        .getAllByText(/./, { selector: "span.text-\\[11\\.5px\\]" })
        .map((e) => e.textContent)
    ).toEqual([
      "New users",
      "App installs",
      "Link-driven installs",
      "Organic installs",
      "Referred users",
      "View → install",
    ]);
    expect(tile("New users")).toHaveTextContent("1.2K");
    expect(tile("New users")).toHaveTextContent("20%");
    const conv = screen.getByText("5.3%");
    expect(conv.className).toContain("text-[var(--chart-users)]");
  });

  it("shows — for view → install when nothing was viewed", () => {
    mockKm(metrics({ link_views: 0, link_driven_installs: 0 }));
    renderRow("kpis_links");
    expect(tile("View → install")).toHaveTextContent("—");
    expect(tile("App opens from links")).toHaveTextContent("300");
  });

  it("reads day 7 retention from the retention summary", () => {
    mockKm(metrics());
    vi.mocked(useRetentionSummaryQuery).mockImplementation(
      (_p, params) =>
        ({
          data:
            params?.start_date === base.start_date
              ? { day_7: 21.4 }
              : { day_7: 20 },
          isFetching: false,
        }) as never
    );
    renderRow("kpis_engagement");
    expect(tile("Day 7 retention")).toHaveTextContent("21.4%");
    expect(tile("Returning rate")).toHaveTextContent("38.2%");
    expect(useRetentionSummaryQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ start_date: base.start_date }),
      true
    );
  });

  it("passes a single platform filter to retention", () => {
    mockKm(metrics());
    const filters = JSON.stringify([
      { field: "platform", operator: "is", value: "ios" },
    ]);
    render(
      <KpiRowPanel
        projectId="p1"
        panel="kpis_engagement"
        params={{ ...base, filters }}
        prevParams={undefined}
        enabled
      />
    );
    expect(useRetentionSummaryQuery).toHaveBeenCalledWith(
      "p1",
      { ...base, platform: "ios" },
      true
    );
  });

  it("blanks day 7 retention and skips its query for other filters", () => {
    mockKm(metrics());
    vi.mocked(useRetentionSummaryQuery).mockReturnValue({
      data: { day_7: 21.4 },
      isFetching: false,
    } as never);
    const filters = JSON.stringify([
      { field: "platform", operator: "is", value: "ios" },
      { field: "campaign", operator: "is", value: "spring" },
    ]);
    render(
      <KpiRowPanel
        projectId="p1"
        panel="kpis_engagement"
        params={{ ...base, filters }}
        prevParams={{ ...prev, filters }}
        enabled
      />
    );
    expect(tile("Day 7 retention")).toHaveTextContent("—");
    expect(tile("Returning rate")).toHaveTextContent("38.2%");
    expect(
      vi.mocked(useRetentionSummaryQuery).mock.calls.every((c) => !c[2])
    ).toBe(true);
  });

  it("formats revenue tiles as money and blanks unsupported ones", () => {
    mockKm(metrics(), undefined, ["arpu"]);
    renderRow("kpis_revenue");
    expect(tile("Revenue")).toHaveTextContent("$18,240.00");
    expect(tile("ARPU")).toHaveTextContent("—");
    expect(tile("ARPPU")).toHaveTextContent("$22.10");
  });

  it("asks for the current and previous period", () => {
    mockKm(metrics());
    renderRow("kpis_links");
    expect(useOverviewKeyMetricsQuery).toHaveBeenCalledWith("p1", base, true);
    expect(useOverviewKeyMetricsQuery).toHaveBeenCalledWith("p1", prev, true);
    expect(useRetentionSummaryQuery).toHaveBeenCalledWith(
      "p1",
      expect.anything(),
      false
    );
  });
});
