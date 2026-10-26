import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => mockSearchParams }));
vi.mock("@/hooks/queries/useMetricQuery", () => ({ useMetricQuery: vi.fn() }));
vi.mock("@/hooks/queries/useAnalyticsEventsQueries", () => ({
  useAnalyticsEventFieldsQuery: vi.fn(() => ({ data: undefined })),
}));

import { useMetricQuery } from "@/hooks/queries/useMetricQuery";
import { BreakdownPanel } from "../BreakdownPanel";

const base = { start_date: "2026-09-01", end_date: "2026-09-30" };
const limits = { rangeSpanDays: 29 };
const response = {
  metric: "installs",
  group_by: "country",
  rows: [{ key: "RO", label: "RO", value: 3 }],
  other: null,
  total: { value: 3 },
};

describe("BreakdownPanel", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    window.history.replaceState(null, "", "/dashboard");
    vi.mocked(useMetricQuery).mockReset();
    vi.mocked(useMetricQuery).mockReturnValue({
      data: response,
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
  });

  it("defaults to country and the card's metric", () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="app_opens"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        metric: "app_opens",
        group_by: "country",
        limit: 10,
      }),
      true
    );
    expect(screen.getByText("Romania")).toBeInTheDocument();
  });

  it("falls back to installs for cards without a counter", () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="new_users"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "installs" }),
      true
    );
  });

  it("adds a filter chip when a row is clicked", async () => {
    const onAddFilter = vi.fn();
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={onAddFilter}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Romania/ }));
    expect(onAddFilter).toHaveBeenCalledWith("country", "RO", "is", "Romania");
  });

  it("reads the dimension from the URL", () => {
    mockSearchParams = new URLSearchParams("breakdown=os");
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ group_by: "os" }),
      true
    );
  });

  it("requests granularity when the timeline toggle is on and compare when vs previous is on", async () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="week"
        onAddFilter={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("combobox", { name: "View" }));
    await userEvent.click(screen.getByRole("option", { name: "Timeline" }));
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ granularity: "week" }),
      true
    );
    await userEvent.click(screen.getByRole("combobox", { name: "View" }));
    await userEvent.click(screen.getByRole("option", { name: "Bar list" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Compare" }));
    await userEvent.click(
      screen.getByRole("option", { name: "Previous period" })
    );
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ compare: "true" }),
      true
    );
  });

  it("runs a raw counter breakdown within the long cap", () => {
    mockSearchParams = new URLSearchParams("breakdown=city");
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={{ ...limits, rangeSpanDays: 182 }}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "installs", group_by: "city" }),
      true
    );
  });

  it("holds a raw unique breakdown past its cap and says why", () => {
    mockSearchParams = new URLSearchParams("breakdown=city");
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={{ ...limits, rangeSpanDays: 182 }}
        cardMetric="unique_visitors"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "unique_visitors", group_by: "city" }),
      false
    );
    expect(screen.getByText(/limited to 90 days/)).toBeInTheDocument();
  });

  it("keeps a rollup breakdown running over a long range", () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={{ ...limits, rangeSpanDays: 182 }}
        cardMetric="unique_visitors"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ group_by: "country" }),
      true
    );
  });

  it("resets a manual metric override when the card changes", async () => {
    const { rerender } = render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Metric" }));
    await userEvent.click(await screen.findByRole("option", { name: "Views" }));
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ metric: "views" }),
      true
    );

    rerender(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="app_opens"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ metric: "app_opens" }),
      true
    );
  });

  it("labels a property dimension from the URL before the picker opens", () => {
    mockSearchParams = new URLSearchParams("breakdown=properties.plan");
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(screen.getByText(/by plan\./)).toBeInTheDocument();
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ group_by: "properties.plan" }),
      true
    );
  });

  it("has no Save to dashboard button", () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
      />
    );
    expect(
      screen.queryByRole("button", { name: /save to dashboard/i })
    ).not.toBeInTheDocument();
  });

  it("seeds the metric override and timeline from initial", () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
        initial={{ metric: "views", timeline: true }}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "views", granularity: "day" }),
      true
    );
    expect(screen.getByRole("combobox", { name: "View" })).toHaveTextContent(
      "Timeline"
    );
  });

  it("seeds compare from initial", () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
        initial={{ compare: true }}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ compare: "true" }),
      true
    );
    expect(screen.getByRole("combobox", { name: "Compare" })).toHaveTextContent(
      "Previous period"
    );
  });

  it("calls onChange when compare is toggled", async () => {
    const onChange = vi.fn();
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Compare" }));
    await userEvent.click(
      screen.getByRole("option", { name: "Previous period" })
    );
    expect(onChange).toHaveBeenCalledWith({
      metric: undefined,
      timeline: false,
      compare: true,
      limit: 10,
    });
  });

  it("calls onChange with the overridden metric", async () => {
    const onChange = vi.fn();
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Metric" }));
    await userEvent.click(await screen.findByRole("option", { name: "Views" }));
    expect(onChange).toHaveBeenCalledWith({
      metric: "views",
      timeline: false,
      compare: false,
      limit: 10,
    });
  });
  it("lets the user raise Top and reports it", async () => {
    const onChange = vi.fn();
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
        onChange={onChange}
      />
    );
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ limit: 10 }),
      true
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Top" }));
    await userEvent.click(screen.getByRole("option", { name: "Top 20" }));
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ limit: 20 }),
      true
    );
    expect(onChange).toHaveBeenLastCalledWith({
      metric: undefined,
      timeline: false,
      compare: false,
      limit: 20,
    });
  });

  it("seeds Top from initial and ignores values outside the options", () => {
    render(
      <BreakdownPanel
        projectId="p1"
        base={base}
        filters={[]}
        limits={limits}
        cardMetric="installs"
        granularity="day"
        onAddFilter={() => {}}
        initial={{ limit: 50 }}
      />
    );
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ limit: 50 }),
      true
    );
  });
});
