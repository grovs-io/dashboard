import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/queries/useMetricQuery", () => ({ useMetricQuery: vi.fn() }));
vi.mock("@/hooks/queries/useAnalyticsEventsQueries", () => ({
  useAnalyticsEventFieldsQuery: vi.fn(() => ({ data: undefined })),
  // Shaped like the hook's infinite result; the QueryBar and Event picker flatten pages[].values.
  useAnalyticsEventFieldValuesQuery: vi.fn(
    (_projectId: string | undefined, params?: { field: string }) => ({
      data: {
        pages: [
          {
            values:
              params?.field === "event_name"
                ? ["buy", "view_item"]
                : ["RO", "DE"],
          },
        ],
      },
      isLoading: false,
      hasNextPage: false,
    })
  ),
}));
vi.mock("@/hooks/queries/useAnalyticsOverviewQueries", () => ({
  useOverviewKeyMetricsQuery: vi.fn(() => ({
    data: undefined,
    isFetching: false,
  })),
  useOverviewUserTrendsQuery: vi.fn(() => ({
    data: { points: [] },
    isFetching: false,
  })),
}));
vi.mock("@/hooks/queries/useAnalyticsRetentionQueries", () => ({
  useRetentionSummaryQuery: vi.fn(() => ({
    data: {
      day_1: 40,
      day_7: 20,
      day_30: 10,
      median_churn_day: 3,
      sparkline: [],
    },
    isFetching: false,
  })),
}));
vi.mock("@/hooks/queries/useDashboardQueries", () => ({
  useTopLinksQuery: vi.fn(() => ({ data: [], isFetching: false })),
}));
vi.mock("@/hooks/queries/useCampaignsQueries", () => ({
  useCampaignsListQuery: vi.fn(() => ({ data: undefined, isFetching: false })),
}));
import { useMetricQuery } from "@/hooks/queries/useMetricQuery";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import { useOverviewUserTrendsQuery } from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useAnalyticsEventFieldValuesQuery } from "@/hooks/queries/useAnalyticsEventsQueries";
import { WidgetDialog } from "../WidgetDialog";
import type { DashboardWidget } from "@/types";

// Radix popper/Switch need ResizeObserver, which jsdom doesn't ship.
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

const dashboards = [
  {
    id: 1,
    name: "Growth",
    position: 0,
    widgets: [],
    created_at: "",
    updated_at: "",
  },
  {
    id: 2,
    name: "Marketing",
    position: 1,
    widgets: [],
    created_at: "",
    updated_at: "",
  },
];
const base = { start_date: "2026-09-01", end_date: "2026-09-30" };
const limits = { rangeSpanDays: 29 };
const meta = {
  id: 7,
  dashboard_id: 2,
  position: 0,
  created_at: "",
  updated_at: "",
};
const preview = () => screen.getByRole("region", { name: "Preview" });

type Props = Partial<React.ComponentProps<typeof WidgetDialog>>;
const renderDialog = (props: Props = {}) =>
  render(
    <WidgetDialog
      open
      onOpenChange={() => {}}
      projectId="p1"
      dashboards={dashboards}
      base={base}
      limits={limits}
      granularity="day"
      filters={[]}
      onSubmit={vi.fn()}
      {...props}
    />
  );

const fieldValues =
  (eventNames: string[]) =>
  (_projectId: string | undefined, params?: { field: string }) => ({
    data: {
      pages: [
        { values: params?.field === "event_name" ? eventNames : ["RO", "DE"] },
      ],
    },
    isLoading: false,
    hasNextPage: false,
  });

async function pickEvent(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Event" }));
  await userEvent.click(await screen.findByRole("option", { name }));
}
async function pickMeasure(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Measure" }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

describe("WidgetDialog", () => {
  beforeEach(() => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: {
        metric: "installs",
        group_by: "country",
        rows: [{ key: "RO", label: "RO", value: 3 }],
        other: null,
        total: { value: 3 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
  });

  it("labels the title field and builds Show / Filter / Break down by sections", () => {
    renderDialog();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAttribute(
      "id",
      "widget-title"
    );
    expect(screen.getByText("Show")).toBeInTheDocument();
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("Break down by")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveTextContent(
      "Install"
    );
    expect(screen.getByRole("combobox", { name: "Measure" })).toHaveTextContent(
      "Count"
    );
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("submits a prefilled query to the preselected dashboard", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      onSubmit,
      granularity: "week",
      initial: {
        metric: "app_opens",
        group_by: "os",
        viz: "line",
        compare: false,
      },
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveTextContent(
      "App open"
    );
    await userEvent.type(screen.getByLabelText(/title/i), "Opens by OS");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      dashboardId: 1,
      payload: {
        title: "Opens by OS",
        kind: "metric",
        panel: null,
        viz: "line",
        size: "md",
        query: {
          metric: "app_opens",
          group_by: "os",
          limit: 10,
          compare: false,
          granularity: "week",
        },
        filters: [{ field: "country", operator: "is", value: "RO" }],
      },
    });
  });

  it("choosing a custom event name counts events with a managed event_name chip", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      onSubmit,
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    await pickEvent("buy");
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveTextContent(
      "buy"
    );
    // The managed chip lives in the Event picker, never among the Filter chips.
    expect(
      screen.queryByRole("button", { name: "Remove Event name filter" })
    ).toBeNull();
    await userEvent.type(screen.getByLabelText(/title/i), "Purchases");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          query: expect.objectContaining({ metric: "events" }),
          filters: [
            { field: "event_name", operator: "is", value: "buy" },
            { field: "country", operator: "is", value: "RO" },
          ],
        }),
      })
    );
  });

  it("Unique visitors of Install sends unique_visitors with an event_type chip", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSubmit });
    await pickMeasure("Unique visitors");
    await pickEvent("Install");
    await userEvent.type(screen.getByLabelText(/title/i), "Installers");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          query: expect.objectContaining({ metric: "unique_visitors" }),
          filters: [{ field: "event_type", operator: "is", value: "install" }],
        }),
      })
    );
  });

  it("a new widget saves only its own chips while the preview still follows the page's", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const pageChips = [{ field: "country", operator: "is", value: "RO" }];
    renderDialog({
      onSubmit,
      base: { ...base, filters: JSON.stringify(pageChips) },
      filters: [],
    });
    await pickMeasure("Unique visitors");
    await pickEvent("Install");
    expect(vi.mocked(useMetricQuery).mock.lastCall?.[1]).toEqual(
      expect.objectContaining({
        filters: JSON.stringify([
          ...pageChips,
          { field: "event_type", operator: "is", value: "install" },
        ]),
      })
    );
    await userEvent.type(screen.getByLabelText(/title/i), "Installers");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          filters: [{ field: "event_type", operator: "is", value: "install" }],
        }),
      })
    );
  });

  it("link events only allow Count", async () => {
    renderDialog();
    await pickMeasure("Unique devices");
    await pickEvent("Link view (via link)");
    expect(screen.getByRole("combobox", { name: "Measure" })).toHaveTextContent(
      "Count"
    );
    expect(
      screen.getByText("Only Count is available for link events")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Measure" }));
    expect(
      await screen.findByRole("option", { name: "Unique visitors" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("edits a widget whose event came from a stored chip", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const widget: DashboardWidget = {
      ...meta,
      title: "Buys",
      kind: "metric",
      panel: null,
      viz: "table",
      size: "lg",
      query: { metric: "events", group_by: "os", limit: 5, compare: true },
      filters: [
        { field: "event_name", operator: "is", value: "buy" },
        { field: "platform", operator: "is", value: "ios" },
      ],
    };
    renderDialog({ onSubmit, widget, filters: widget.filters });
    expect(screen.queryByRole("tablist", { name: "Widget kind" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Dashboard" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveTextContent(
      "buy"
    );
    expect(
      screen.getByRole("button", { name: "Remove Platform filter" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Event name filter" })
    ).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /save widget/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      dashboardId: 2,
      payload: expect.objectContaining({
        title: "Buys",
        kind: "metric",
        viz: "table",
        size: "lg",
        filters: widget.filters,
      }),
    });
  });

  it("keeps a copied subtitle when the stored query only differs in key order", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const widget: DashboardWidget = {
      ...meta,
      title: "Buys",
      subtitle: "Top 5",
      kind: "metric",
      panel: null,
      viz: "table",
      size: "lg",
      query: { compare: true, limit: 5, group_by: "os", metric: "events" },
      filters: [{ field: "event_name", operator: "is", value: "buy" }],
    };
    renderDialog({ onSubmit, widget, filters: widget.filters });
    await userEvent.click(screen.getByRole("button", { name: /save widget/i }));
    // No subtitle key: the server keeps the copied one.
    expect(onSubmit.mock.calls[0]![0].payload).not.toHaveProperty("subtitle");
  });

  it("drops a copied subtitle once the metric changes", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const widget: DashboardWidget = {
      ...meta,
      title: "Buys",
      subtitle: "Top 5",
      kind: "metric",
      panel: null,
      viz: "table",
      size: "lg",
      query: { compare: true, limit: 5, group_by: "os", metric: "events" },
      filters: [{ field: "event_name", operator: "is", value: "buy" }],
    };
    renderDialog({ onSubmit, widget, filters: widget.filters });
    await pickMeasure("Unique devices");
    await userEvent.click(screen.getByRole("button", { name: /save widget/i }));
    const payload = onSubmit.mock.calls[0]![0].payload;
    expect(payload.query.metric).not.toBe("events");
    expect(payload.subtitle).toBeNull();
  });

  it("breaks down by a dimension with a Top limit, hidden for Number", async () => {
    const { useAnalyticsEventFieldsQuery } =
      await import("@/hooks/queries/useAnalyticsEventsQueries");
    vi.mocked(useAnalyticsEventFieldsQuery).mockReturnValue({
      data: { fields: [{ name: "plan", type: "property" }] },
    } as never);
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSubmit });
    expect(
      screen.getByRole("combobox", { name: "Group by" })
    ).toHaveTextContent("Country");
    await userEvent.click(screen.getByRole("combobox", { name: "Group by" }));
    expect(vi.mocked(useAnalyticsEventFieldsQuery)).toHaveBeenCalledWith(
      "p1",
      true
    );
    await userEvent.click(await screen.findByRole("option", { name: "plan" }));
    expect(
      screen.getByRole("combobox", { name: "Group by" })
    ).toHaveTextContent("plan");
    await userEvent.click(screen.getByRole("combobox", { name: "Top" }));
    await userEvent.click(screen.getByRole("option", { name: "Top 5" }));
    await userEvent.type(screen.getByLabelText(/title/i), "By plan");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          query: expect.objectContaining({
            group_by: "properties.plan",
            limit: 5,
          }),
        }),
      })
    );
    await userEvent.click(screen.getByRole("button", { name: "Number" }));
    expect(screen.queryByRole("combobox", { name: "Top" })).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Group by" })
    ).toHaveTextContent("None (total)");
    vi.mocked(useAnalyticsEventFieldsQuery).mockReturnValue({
      data: undefined,
    } as never);
  });

  it("puts the chart controls on the preview pane; Timeline disables compare", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSubmit });
    const pane = preview();
    expect(
      within(
        within(pane).getByRole("group", { name: "Chart type" })
      ).getAllByRole("button")
    ).toHaveLength(4);
    expect(
      within(pane).getByRole("combobox", { name: "Size" })
    ).toHaveTextContent("Medium");
    expect(within(pane).getByText("Romania")).toBeInTheDocument();
    expect(within(pane).getByText("Untitled widget")).toBeInTheDocument();
    expect(
      within(pane).getByText("Count of Install · by Country")
    ).toBeInTheDocument();
    expect(
      within(pane).getByText("Follows the dashboard's date range and filters.")
    ).toBeInTheDocument();
    expect(
      within(pane).getByRole("button", { name: "Bar list" })
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      within(pane).getByRole("combobox", { name: "Compare" })
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Previous period" })
    );
    expect(
      within(pane).getByRole("combobox", { name: "Compare" })
    ).toHaveTextContent("Previous period");
    await userEvent.click(
      within(pane).getByRole("button", { name: "Timeline" })
    );
    const compare = within(pane).getByRole("combobox", { name: "Compare" });
    expect(compare).toHaveTextContent("No previous period");
    expect(compare).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/title/i), "Trend");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          viz: "line",
          query: expect.objectContaining({ compare: false }),
        }),
      })
    );
  });

  it("adds a Library panel as a widget", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      onSubmit,
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    await userEvent.click(
      within(screen.getByRole("tablist", { name: "Widget kind" })).getByRole(
        "tab",
        { name: "Library" }
      )
    );
    expect(screen.queryByRole("combobox", { name: "Event" })).toBeNull();
    expect(
      within(preview()).queryByRole("group", { name: "Chart type" })
    ).toBeNull();
    const retention = screen.getByRole("button", { name: /^Retention/ });
    await userEvent.click(retention);
    expect(retention).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(
        "This panel follows the dashboard's date range and platform only."
      )
    ).toBeInTheDocument();
    expect(useRetentionSummaryQuery).toHaveBeenCalled();
    expect(within(preview()).getByText("Day 7")).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue("Retention");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      dashboardId: 1,
      payload: expect.objectContaining({
        title: "Retention",
        kind: "panel",
        panel: "retention",
        query: {},
        filters: [],
      }),
    });
  });

  it("previews the New users trend panel with the dialog granularity", async () => {
    renderDialog({
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    await userEvent.click(screen.getByRole("tab", { name: "Library" }));
    await userEvent.click(
      screen.getByRole("button", { name: /^New users trend/ })
    );
    expect(
      screen.getByRole("button", { name: "Remove Country filter" })
    ).toBeInTheDocument();
    expect(useOverviewUserTrendsQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ granularity: "day" }),
      true
    );
    expect(
      within(preview()).getByText("No new users in this date range.")
    ).toBeInTheDocument();
  });

  it("filter-honouring panels keep the Filter bar and submit its chips", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      onSubmit,
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    await userEvent.click(screen.getByRole("tab", { name: "Library" }));
    await userEvent.click(
      screen.getByRole("button", { name: /^Acquisition channels/ })
    );
    expect(
      screen.getByRole("button", { name: "Remove Country filter" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: "panel",
          panel: "acquisition_channels",
          filters: [{ field: "country", operator: "is", value: "RO" }],
        }),
      })
    );
  });

  it("edits a panel widget with its kind fixed", () => {
    const widget: DashboardWidget = {
      ...meta,
      title: "Ret",
      kind: "panel",
      panel: "retention",
      viz: "bar",
      size: "sm",
      query: {},
      filters: [],
    };
    renderDialog({ widget });
    expect(screen.queryByRole("tablist", { name: "Widget kind" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Retention/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("footer picks the target dashboard without a New dashboard option", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSubmit, defaultDashboardId: 2 });
    const select = screen.getByRole("combobox", { name: "Dashboard" });
    expect(select).toHaveTextContent("Marketing");
    await userEvent.click(select);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Growth",
      "Marketing",
    ]);
    expect(screen.queryByRole("option", { name: /new dashboard/i })).toBeNull();
    await userEvent.click(screen.getByRole("option", { name: "Growth" }));
    await userEvent.type(screen.getByLabelText(/title/i), "X");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardId: 1 })
    );
  });

  it("holds the preview and explains why when the query would exceed the raw cap", () => {
    renderDialog({
      limits: { rangeSpanDays: 120 },
      initial: { metric: "unique_visitors", group_by: "city" },
    });
    expect(useMetricQuery).toHaveBeenLastCalledWith(
      "p1",
      expect.objectContaining({ metric: "unique_visitors", group_by: "city" }),
      false
    );
    expect(
      within(preview()).getByText(/limited to 90 days/)
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/limited to 90 days/);
  });

  it("blocks submit on an empty title", async () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /title is required/i
    );
  });

  it("adds a Filter chip with the embedded QueryBar", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSubmit });
    await userEvent.click(screen.getByPlaceholderText("Filter events..."));
    await userEvent.click(
      await screen.findByRole("option", { name: /^country/i })
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /^is\s*include$/i })
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Romania" })
    );
    expect(
      screen.getByRole("button", { name: "Remove Country filter" })
    ).toBeInTheDocument();
    expect(within(preview()).getByText(/1 filter/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/title/i), "Romania installs");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          filters: [{ field: "country", operator: "is", value: "RO" }],
        }),
      })
    );
  });

  it("removing a Filter chip drops it from the payload without submitting", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      onSubmit,
      filters: [
        { field: "country", operator: "is", value: "RO" },
        { field: "platform", operator: "is_not", value: "web" },
      ],
    });
    expect(within(preview()).getByText(/2 filters/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Country filter" })
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/title/i), "No RO");
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          filters: [{ field: "platform", operator: "is_not", value: "web" }],
        }),
      })
    );
  });

  it("closing with unsaved changes asks for confirmation", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    await pickEvent("buy");
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(
      await screen.findByText("Discard unsaved changes?")
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Continue editing" })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Discard" })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes straight away when nothing changed, even with a claimed chip in reordered jsonb", async () => {
    const onOpenChange = vi.fn();
    const filters = [
      { value: "buy", field: "event_name", operator: "is" as const },
      { value: "RO", field: "country", operator: "is" as const },
    ];
    const widget: DashboardWidget = {
      ...meta,
      title: "T",
      kind: "metric",
      panel: null,
      viz: "table",
      size: "lg",
      filters,
      query: { metric: "unique_visitors", group_by: "os", limit: 5 },
    };
    renderDialog({ onOpenChange, widget, filters });
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  it("shows Saving… and locks closing while pending", () => {
    renderDialog({ pending: true });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
  });

  it("debounces the event search: a burst of keystrokes asks for one search term", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("combobox", { name: "Event" }));
    const input = await screen.findByPlaceholderText("Search events…");
    const searched = () =>
      vi
        .mocked(useAnalyticsEventFieldValuesQuery)
        .mock.calls.map(
          (c) => c[1] as { field: string; q?: string } | undefined
        )
        .filter((p) => p?.field === "event_name" && p.q)
        .map((p) => p!.q);
    vi.useFakeTimers();
    try {
      vi.mocked(useAnalyticsEventFieldValuesQuery).mockClear();
      fireEvent.change(input, { target: { value: "b" } });
      fireEvent.change(input, { target: { value: "bu" } });
      fireEvent.change(input, { target: { value: "buy" } });
      act(() => vi.advanceTimersByTime(249));
      expect(searched()).toEqual([]);
      act(() => vi.advanceTimersByTime(1));
      expect(new Set(searched())).toEqual(new Set(["buy"]));
      expect(
        vi.mocked(useAnalyticsEventFieldValuesQuery).mock.calls.at(-1)?.[2]
      ).toEqual({ keepPrevious: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so when the project has no custom events", async () => {
    vi.mocked(useAnalyticsEventFieldValuesQuery).mockImplementation(
      fieldValues([]) as never
    );
    try {
      renderDialog();
      await userEvent.click(screen.getByRole("combobox", { name: "Event" }));
      expect(
        await screen.findByRole("option", { name: "No custom events found." })
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("option", { name: "Install" })
      ).toBeInTheDocument();
    } finally {
      vi.mocked(useAnalyticsEventFieldValuesQuery).mockImplementation(
        fieldValues(["buy", "view_item"]) as never
      );
    }
  });

  it("a new session never previews the previous session's widget", () => {
    const widgetA: DashboardWidget = {
      ...meta,
      id: 1,
      title: "A",
      kind: "metric",
      panel: null,
      viz: "bar",
      size: "md",
      filters: [],
      query: { metric: "opens", group_by: "os", limit: 10 },
    };
    const widgetB: DashboardWidget = {
      ...meta,
      id: 2,
      title: "B",
      kind: "metric",
      panel: null,
      viz: "bar",
      size: "md",
      filters: [],
      query: { metric: "reinstalls", group_by: "country", limit: 10 },
    };
    const props = {
      onOpenChange: () => {},
      projectId: "p1",
      dashboards,
      base,
      limits,
      granularity: "day" as const,
      onSubmit: vi.fn(),
    };
    // Mirrors the page: a fresh key per open, "closed" in between.
    const { rerender } = render(
      <WidgetDialog
        key="session-1"
        open
        widget={widgetA}
        filters={widgetA.filters}
        {...props}
      />
    );
    rerender(
      <WidgetDialog key="closed" open={false} filters={[]} {...props} />
    );
    vi.mocked(useMetricQuery).mockClear();
    rerender(
      <WidgetDialog
        key="session-2"
        open
        widget={widgetB}
        filters={widgetB.filters}
        {...props}
      />
    );
    const calls = vi.mocked(useMetricQuery).mock.calls;
    expect(calls[0]![1]).toMatchObject({
      metric: "reinstalls",
      group_by: "country",
    });
    expect(
      calls.some((c) => (c[1] as { metric: string }).metric === "opens")
    ).toBe(false);
  });

  it("Library lists ready-made panels and presets under their own captions", async () => {
    renderDialog();
    const tabs = screen.getByRole("tablist", { name: "Widget kind" });
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((t) => t.textContent)
    ).toEqual(["Metric", "Library"]);
    await userEvent.click(within(tabs).getByRole("tab", { name: "Library" }));
    expect(screen.getByText("Ready-made panels")).toBeInTheDocument();
    // Filter belongs to the selected panel, so it sits between the panels and the presets.
    const captions = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(
      captions.filter((c) =>
        ["Ready-made panels", "Filter", "Or start from a preset"].includes(
          c ?? ""
        )
      )
    ).toEqual(["Ready-made panels", "Filter", "Or start from a preset"]);
    const panels = within(
      screen
        .getByRole("heading", { name: "Ready-made panels" })
        .closest("section")!
    ).getAllByRole("button");
    expect(panels).toHaveLength(8);
    expect(panels[0]).toHaveAccessibleName(/^New users trend/);
    for (const name of [
      "Installs by country",
      "Daily installs",
      "Unique visitors",
      "App opens by version",
      "Top links",
      "Events by name",
    ]) {
      expect(
        screen.getAllByRole("button", { name: new RegExp(`^${name}`) }).length
      ).toBeGreaterThan(0);
    }
  });

  it("picking a preset lands in the Metric builder prefilled from the template", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      onSubmit,
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    await userEvent.click(screen.getByRole("tab", { name: "Library" }));
    await userEvent.click(
      screen.getByRole("button", { name: /^Installs by country/ })
    );
    expect(screen.getByRole("tab", { name: "Metric" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue("Installs by country");
    expect(screen.getByRole("combobox", { name: "Event" })).toHaveTextContent(
      "Install"
    );
    expect(screen.getByRole("combobox", { name: "Measure" })).toHaveTextContent(
      "Count"
    );
    expect(
      screen.getByRole("combobox", { name: "Group by" })
    ).toHaveTextContent("Country");
    expect(
      within(preview()).getByRole("button", { name: "Bar list" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(preview()).getByRole("combobox", { name: "Size" })
    ).toHaveTextContent("Medium");
    // The template's (empty) filters replace the chips that were there.
    expect(
      screen.queryByRole("button", { name: "Remove Country filter" })
    ).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: "metric",
          title: "Installs by country",
          viz: "bar",
          size: "md",
          query: expect.objectContaining({
            metric: "installs",
            group_by: "country",
            limit: 10,
          }),
          filters: [],
        }),
      })
    );
  });

  it("Library shows the Filter section with the bar, or the date-only note", async () => {
    renderDialog({
      filters: [{ field: "country", operator: "is", value: "RO" }],
    });
    await userEvent.click(screen.getByRole("tab", { name: "Library" }));
    await userEvent.click(screen.getByRole("button", { name: /^Engagement/ }));
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(
      screen.getByText("Applied on top of the dashboard's filters.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Country filter" })
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /^Top campaigns/ })
    );
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This panel follows the dashboard's date range and platform only."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Country filter" })
    ).toBeNull();
  });
});
