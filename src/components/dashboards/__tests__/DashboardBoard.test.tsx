import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/queries/useMetricQuery", () => ({ useMetricQuery: vi.fn() }));
vi.mock("@/hooks/mutations/useDashboardsMutations", () => ({
  useUpdateDashboardMutation: vi.fn(),
  useDeleteDashboardMutation: vi.fn(),
  useDeleteWidgetMutation: vi.fn(),
}));
vi.mock("../PanelWidget", () => ({
  PanelWidget: (p: {
    panel: string;
    revenueEnabled: boolean;
    filters: unknown[];
  }) => (
    <div>
      panel:{p.panel}:{String(p.revenueEnabled)}:{p.filters.length}
    </div>
  ),
}));
import { useMetricQuery } from "@/hooks/queries/useMetricQuery";
import {
  useUpdateDashboardMutation,
  useDeleteDashboardMutation,
  useDeleteWidgetMutation,
} from "@/hooks/mutations/useDashboardsMutations";
import { DashboardBoard } from "../DashboardBoard";
import type { Dashboard, MetricQueryParams } from "@/types";

const widget = (id: number, title: string) => ({
  id,
  dashboard_id: 1,
  title,
  kind: "metric" as const,
  panel: null,
  viz: "bar" as const,
  size: "md" as const,
  position: id,
  created_at: "",
  updated_at: "",
  query: {
    metric: "installs" as const,
    group_by: "country",
    limit: 10,
    compare: false,
  },
  filters: [{ field: "country", operator: "is" as const, value: "RO" }],
});
const dashboard = {
  id: 1,
  name: "Growth",
  position: 0,
  created_at: "",
  updated_at: "",
  widgets: [widget(1, "First"), widget(2, "Second")],
};
const base = { start_date: "2026-09-01", end_date: "2026-09-30" };
const pageFilters = [
  { id: "p", field: "platform", value: "ios", operator: "is" as const },
];
const limits = { rangeSpanDays: 29 };
const noop = () => {};
const noopCreate = async () => {};
const renderBoard = (
  d: Dashboard,
  props: Partial<{
    pageFilters: typeof pageFilters;
    limits: typeof limits;
    granularity: "day" | "week";
  }> = {}
) =>
  render(
    <DashboardBoard
      dashboard={d}
      projectId="p1"
      base={base}
      pageFilters={props.pageFilters ?? []}
      granularity={props.granularity ?? "day"}
      limits={props.limits ?? limits}
      onAddWidget={noop}
      onEditWidget={noop}
      onRename={noop}
      onDeleted={noop}
      onCreateWidget={noopCreate}
    />
  );

describe("DashboardBoard", () => {
  const update = {
    mutateAsync: vi.fn().mockResolvedValue(dashboard),
    isPending: false,
  };
  const del = {
    mutateAsync: vi.fn().mockResolvedValue({ message: "ok" }),
    isPending: false,
  };
  const delWidget = {
    mutateAsync: vi.fn().mockResolvedValue({ message: "ok" }),
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(useUpdateDashboardMutation).mockReturnValue(update as never);
    vi.mocked(useDeleteDashboardMutation).mockReturnValue(del as never);
    vi.mocked(useDeleteWidgetMutation).mockReturnValue(delWidget as never);
  });

  it("renders every widget with merged filters and page dates", () => {
    render(
      <DashboardBoard
        dashboard={dashboard}
        projectId="p1"
        base={base}
        pageFilters={pageFilters}
        granularity="day"
        limits={limits}
        onAddWidget={() => {}}
        onEditWidget={() => {}}
        onRename={() => {}}
        onDeleted={() => {}}
        onCreateWidget={noopCreate}
      />
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    // Subtitle counts only the widget's own Filter chips.
    expect(
      screen.getAllByText("Count of Install · by Country · 1 filter")
    ).toHaveLength(2);
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        start_date: "2026-09-01",
        metric: "installs",
        group_by: "country",
        filters: JSON.stringify([
          { field: "platform", operator: "is", value: "ios" },
          { field: "country", operator: "is", value: "RO" },
        ]),
      }),
      true
    );
  });

  it("shows a copied widget's stored subtitle, with the page period", () => {
    renderBoard(
      {
        ...dashboard,
        widgets: [
          { ...widget(1, "Installs by country"), subtitle: "Top 5" },
          {
            ...widget(2, "Installs"),
            subtitle: "{period}, vs previous period",
          },
        ],
      } as Dashboard,
      { granularity: "week" }
    );
    expect(screen.getByText("Top 5")).toBeInTheDocument();
    expect(screen.getByText("Weekly, vs previous period")).toBeInTheDocument();
    expect(screen.queryByText(/^Count of/)).toBeNull();
  });

  it("shows the new-board hint above a copied board's widgets until dismissed", async () => {
    window.localStorage.setItem("dashboards:ready-hint:1", "1");
    renderBoard(dashboard);
    expect(screen.getByText("Your board is ready.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText("Your board is ready.")).toBeNull();
    expect(window.localStorage.getItem("dashboards:ready-hint:1")).toBeNull();
  });

  it("shows the empty state with an add call to action", async () => {
    const onAdd = vi.fn();
    render(
      <DashboardBoard
        dashboard={{ ...dashboard, widgets: [] }}
        projectId="p1"
        base={base}
        pageFilters={[]}
        granularity="day"
        limits={limits}
        onAddWidget={onAdd}
        onEditWidget={() => {}}
        onRename={() => {}}
        onDeleted={() => {}}
        onCreateWidget={noopCreate}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("shows the empty state with templates and creates a widget from one in one click", async () => {
    const onCreateWidget = vi.fn().mockResolvedValue(undefined);
    render(
      <DashboardBoard
        dashboard={{ ...dashboard, widgets: [] }}
        projectId="p1"
        base={base}
        pageFilters={[]}
        granularity="day"
        limits={limits}
        onAddWidget={() => {}}
        onEditWidget={() => {}}
        onRename={() => {}}
        onDeleted={() => {}}
        onCreateWidget={onCreateWidget}
      />
    );
    expect(screen.getByText("Your dashboard is empty")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Add Installs by country" })
    );
    expect(onCreateWidget).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Installs by country", viz: "bar" })
    );
  });

  it("deletes a widget from its menu after confirming", async () => {
    render(
      <DashboardBoard
        dashboard={dashboard}
        projectId="p1"
        base={base}
        pageFilters={[]}
        granularity="day"
        limits={limits}
        onAddWidget={() => {}}
        onEditWidget={() => {}}
        onRename={() => {}}
        onDeleted={() => {}}
        onCreateWidget={noopCreate}
      />
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: /widget actions/i })[0]!
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /delete/i })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^delete$/i })
    );
    expect(delWidget.mutateAsync).toHaveBeenCalledWith({
      dashboardId: 1,
      widgetId: 1,
    });
  });

  it("deletes the dashboard after confirming and reports back", async () => {
    const onDeleted = vi.fn();
    render(
      <DashboardBoard
        dashboard={dashboard}
        projectId="p1"
        base={base}
        pageFilters={[]}
        granularity="day"
        limits={limits}
        onAddWidget={() => {}}
        onEditWidget={() => {}}
        onRename={() => {}}
        onDeleted={onDeleted}
        onCreateWidget={noopCreate}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /dashboard actions/i })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /delete dashboard/i })
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^delete$/i })
    );
    expect(del.mutateAsync).toHaveBeenCalledWith(1);
    expect(onDeleted).toHaveBeenCalled();
  });

  it("sends the page granularity only for line widgets", () => {
    const line = { ...widget(1, "Line"), viz: "line" as const, filters: [] };
    const bar = {
      ...widget(2, "Bar"),
      query: { ...widget(2, "Bar").query, metric: "app_opens" as const },
      filters: [],
    };
    renderBoard(
      { ...dashboard, widgets: [line, bar] },
      { granularity: "week" }
    );
    const calls = vi
      .mocked(useMetricQuery)
      .mock.calls.map((c) => c[1] as MetricQueryParams);
    expect(calls.filter((p) => p.metric === "installs")).not.toHaveLength(0);
    expect(
      calls
        .filter((p) => p.metric === "installs")
        .every((p) => p.granularity === "week")
    ).toBe(true);
    expect(calls.filter((p) => p.metric === "app_opens")).not.toHaveLength(0);
    expect(
      calls
        .filter((p) => p.metric === "app_opens")
        .every((p) => !("granularity" in p))
    ).toBe(true);
  });

  it("dedupes a stored chip that repeats a page chip", () => {
    const w = {
      ...widget(1, "iOS"),
      filters: [{ field: "platform", operator: "is" as const, value: "ios" }],
    };
    renderBoard({ ...dashboard, widgets: [w] }, { pageFilters });
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        filters: JSON.stringify([
          { field: "platform", operator: "is", value: "ios" },
        ]),
      }),
      true
    );
  });

  it("holds a widget whose merged filters would exceed the raw-events cap and shows the warning", () => {
    const platformOnly = { ...widget(2, "Platform only"), filters: [] };
    renderBoard(
      { ...dashboard, widgets: [widget(1, "Country"), platformOnly] },
      { pageFilters, limits: { rangeSpanDays: 400 } }
    );
    const byFilters = (json: string) =>
      vi
        .mocked(useMetricQuery)
        .mock.calls.filter(
          (c) => (c[1] as { filters?: string }).filters === json
        );
    const countryCalls = byFilters(
      JSON.stringify([
        { field: "platform", operator: "is", value: "ios" },
        { field: "country", operator: "is", value: "RO" },
      ])
    );
    const platformCalls = byFilters(
      JSON.stringify([{ field: "platform", operator: "is", value: "ios" }])
    );
    expect(countryCalls).not.toHaveLength(0);
    expect(countryCalls.every((c) => c[2] === false)).toBe(true);
    expect(platformCalls).not.toHaveLength(0);
    expect(platformCalls.every((c) => c[2] === true)).toBe(true);
    expect(
      screen.getByText(
        /limited to 366 days\. Narrow the date range or remove filters/i
      )
    ).toBeInTheDocument();
  });

  it("gates each widget on its own metric: raw counters get the long cap, uniques the short one", () => {
    const uniques = {
      ...widget(2, "Uniques"),
      query: {
        ...widget(2, "Uniques").query,
        metric: "unique_visitors" as const,
      },
    };
    renderBoard(
      { ...dashboard, widgets: [widget(1, "Installs"), uniques] },
      { limits: { rangeSpanDays: 120 } }
    );
    const calls = vi.mocked(useMetricQuery).mock.calls;
    const installs = calls.filter(
      (c) => (c[1] as MetricQueryParams).metric === "installs"
    );
    const uniqueCalls = calls.filter(
      (c) => (c[1] as MetricQueryParams).metric === "unique_visitors"
    );
    expect(installs).not.toHaveLength(0);
    expect(installs.every((c) => c[2] === true)).toBe(true);
    expect(uniqueCalls).not.toHaveLength(0);
    expect(uniqueCalls.every((c) => c[2] === false)).toBe(true);
    expect(screen.getByText(/limited to 90 days/i)).toBeInTheDocument();
  });

  it("runs a rollup widget over any range", () => {
    const rollup = { ...widget(1, "Rollup"), filters: [] };
    renderBoard(
      { ...dashboard, widgets: [rollup] },
      { limits: { rangeSpanDays: 1000 } }
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "installs", group_by: "country" }),
      true
    );
  });

  it("portals the header actions into actionsHost and skips its own header row", () => {
    const host = document.body.appendChild(document.createElement("div"));
    render(
      <DashboardBoard
        dashboard={dashboard}
        projectId="p1"
        base={base}
        pageFilters={[]}
        granularity="day"
        limits={limits}
        onAddWidget={() => {}}
        onEditWidget={() => {}}
        onRename={() => {}}
        onDeleted={() => {}}
        onCreateWidget={noopCreate}
        actionsHost={host}
      />
    );
    expect(
      within(host).getByRole("button", { name: /dashboard actions/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(dashboard.name)).toBeNull();
  });

  it("renders panel widgets through PanelWidget with the board's revenue flag", () => {
    const meta = {
      dashboard_id: 1,
      position: 0,
      created_at: "",
      updated_at: "",
      viz: "bar" as const,
      size: "sm" as const,
      query: {},
      filters: [],
    };
    const panels: Dashboard = {
      ...dashboard,
      widgets: [
        { ...meta, id: 1, title: "Ret", kind: "panel", panel: "retention" },
        {
          ...meta,
          id: 2,
          title: "Rev",
          kind: "panel",
          panel: "revenue",
          filters: [{ field: "country", operator: "is", value: "RO" }],
        },
      ],
    };
    render(
      <DashboardBoard
        dashboard={panels}
        projectId="p1"
        base={base}
        pageFilters={[]}
        granularity="day"
        limits={limits}
        revenueEnabled
        onAddWidget={noop}
        onEditWidget={noop}
        onRename={noop}
        onDeleted={noop}
        onCreateWidget={noopCreate}
      />
    );
    expect(screen.getByText("panel:retention:true:0")).toBeInTheDocument();
    expect(screen.getByText("panel:revenue:true:1")).toBeInTheDocument();
    expect(
      screen.getByText("Retention · date & platform only")
    ).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(useMetricQuery).not.toHaveBeenCalled();
  });
});
