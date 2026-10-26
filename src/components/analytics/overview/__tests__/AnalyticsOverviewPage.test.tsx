import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockSearchParams = new URLSearchParams();

// Radix dialog and checkbox measure themselves; jsdom has no ResizeObserver.
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
const { routerPush, openEditLinkDialog, openLinkDialog } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  openEditLinkDialog: vi.fn(),
  openLinkDialog: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: routerPush }),
}));

// Real useUrlState reads, with a per-key spy on writes for the prefs-restore tests.
const { urlSetterSpies } = vi.hoisted(() => ({
  urlSetterSpies: new Map<string, ReturnType<typeof vi.fn>>(),
}));
vi.mock("@/hooks/useUrlState", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useUrlState")>(
    "@/hooks/useUrlState"
  );
  return {
    useUrlState: (key: string, defaultValue: string) => {
      const [value, realSetValue] = actual.useUrlState(key, defaultValue);
      let spy = urlSetterSpies.get(key);
      if (!spy) {
        spy = vi.fn((v: string) => realSetValue(v));
        urlSetterSpies.set(key, spy);
      }
      return [value, spy] as [string, (v: string) => void];
    },
  };
});

const { overviewPrefs } = vi.hoisted(() => ({ overviewPrefs: vi.fn() }));
vi.mock("@/hooks/useOverviewPrefs", () => ({
  useOverviewPrefs: overviewPrefs,
}));

const { showErrorNotification, showGenericError, showSuccessNotification } =
  vi.hoisted(() => ({
    showErrorNotification: vi.fn(),
    showGenericError: vi.fn(),
    showSuccessNotification: vi.fn(),
  }));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification,
  showGenericError,
  showSuccessNotification,
}));

const { instance } = vi.hoisted(() => ({
  instance: {
    current: { id: 1, get_started_dismissed: true } as Record<string, unknown>,
  },
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedProject: { id: "p1" },
    selectedInstance: instance.current,
    getStartedSetup: null,
  }),
}));
vi.mock("@/context/useLinkDialogContext", () => ({
  useGlobalLinkDialog: () => ({ openLinkDialog, openEditLinkDialog }),
}));
vi.mock("@/context/useCreateCampaignDialogContext", () => ({
  useGlobalDialog: () => ({ openDialog: vi.fn() }),
}));
vi.mock("@/hooks/useScaleUpDialog", () => ({
  useScaleUpDialog: () => ({ openScaleUp: vi.fn(), scaleUpDialog: null }),
}));
vi.mock("@/hooks/mutations/useCampaignsMutations", () => ({
  useCreateCampaignMutation: () => ({ mutateAsync: vi.fn() }),
}));
const {
  createDashboard,
  createWidgetMutateAsync,
  updateWidgetMutateAsync,
  copyDashboardMutateAsync,
} = vi.hoisted(() => ({
  createDashboard: vi.fn(),
  createWidgetMutateAsync: vi.fn(),
  updateWidgetMutateAsync: vi.fn(),
  copyDashboardMutateAsync: vi.fn(),
}));
const { sdkStatus } = vi.hoisted(() => ({
  sdkStatus: { current: undefined as Record<string, unknown> | undefined },
}));
vi.mock("@/hooks/queries/useSdkStatusQuery", () => ({
  useSdkStatusQuery: vi.fn(() => ({
    data: sdkStatus.current,
    refetch: vi.fn(),
  })),
}));
vi.mock("@/hooks/mutations/useDashboardsMutations", () => {
  const m = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useCreateDashboardMutation: () => ({
      mutateAsync: createDashboard,
      isPending: false,
    }),
    useUpdateDashboardMutation: m,
    useCreateWidgetMutation: () => ({
      mutateAsync: createWidgetMutateAsync,
      isPending: false,
    }),
    useUpdateWidgetMutation: () => ({
      mutateAsync: updateWidgetMutateAsync,
      isPending: false,
    }),
    useCopyDashboardMutation: () => ({
      mutateAsync: copyDashboardMutateAsync,
      isPending: false,
    }),
  };
});
const idle = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
};
vi.mock("@/hooks/queries/useAnalyticsOverviewQueries", () => ({
  useOverviewUserTrendsQuery: vi.fn(() => idle),
  useOverviewKeyMetricsQuery: vi.fn(() => idle),
}));
vi.mock("@/hooks/queries/useAnalyticsRetentionQueries", () => ({
  useRetentionSummaryQuery: vi.fn(() => idle),
}));
vi.mock("@/hooks/queries/useDashboardQueries", () => ({
  useTopLinksQuery: vi.fn(() => idle),
}));
vi.mock("@/hooks/queries/useCampaignsQueries", () => ({
  useCampaignsListQuery: vi.fn(() => idle),
}));
vi.mock("@/hooks/queries/useDashboardsQueries", () => ({
  useDashboardsQuery: vi.fn(),
}));
vi.mock("@/components/layout/app-header", () => ({ default: () => null }));
vi.mock("@/components/analytics/events/QueryBar", () => ({
  default: () => null,
}));
vi.mock("@/components/dateRangePicker/DateRangePicker", () => ({
  DateRangePicker: () => null,
}));
vi.mock("../OverviewKeyMetrics", () => ({
  METRIC_KEYS: ["new_users"],
  OverviewKeyMetrics: () => null,
}));
vi.mock("../BreakdownPanel", () => ({
  DEFAULT_DIMENSION: "country",
  BreakdownPanel: ({
    onChange,
  }: {
    onChange?: (state: {
      metric?: string;
      timeline: boolean;
      compare: boolean;
      limit: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange?.({
          metric: "views",
          timeline: false,
          compare: true,
          limit: 20,
        })
      }
    >
      Change breakdown
    </button>
  ),
}));
vi.mock("../OverviewMetricGroups", () => ({
  OverviewMetricGroups: () => null,
}));
vi.mock("../AcquisitionChannels", () => ({ AcquisitionChannels: () => null }));
vi.mock("../OverviewTopList", () => ({ OverviewTopList: () => null }));
vi.mock("@/components/dashboards/DashboardBoard", () => ({
  DashboardBoard: ({
    onAddWidget,
    onEditWidget,
  }: {
    onAddWidget: () => void;
    onEditWidget: (widget: {
      id: number;
      dashboard_id: number;
      filters: object[];
    }) => void;
  }) => (
    <div>
      <button type="button" onClick={onAddWidget}>
        Add widget
      </button>
      <button
        type="button"
        onClick={() =>
          onEditWidget({
            id: 7,
            dashboard_id: 5,
            filters: [{ field: "os", operator: "is", value: "iOS" }],
          })
        }
      >
        Edit widget
      </button>
    </div>
  ),
}));
vi.mock("@/components/dashboards/DashboardPicker", () => ({
  MAX_DASHBOARDS: 10,
  DashboardPicker: ({
    active,
    onSelect,
  }: {
    active: string;
    onSelect: (v: string) => void;
  }) => (
    <div>
      <span data-testid="picker-active">{active}</span>
      {["", "acquisition", "revenue", "links", "5"].map((v) => (
        <button key={v} type="button" onClick={() => onSelect(v)}>
          pick:{v || "overview"}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@/components/dashboards/BuiltinBoard", () => ({
  BuiltinBoard: ({
    dashboard,
    onRowClick,
  }: {
    dashboard: { name: string };
    onRowClick: (t: object) => void;
  }) => (
    <div>
      builtin:{dashboard.name}
      <button
        type="button"
        onClick={() => onRowClick({ kind: "campaign", id: "12" })}
      >
        campaign row
      </button>
      <button
        type="button"
        onClick={() => onRowClick({ kind: "link", id: "7" })}
      >
        link row
      </button>
      <button
        type="button"
        onClick={() =>
          onRowClick({ kind: "explorer", href: "/analytics/event_log?x=1" })
        }
      >
        country row
      </button>
    </div>
  ),
}));
vi.mock("@/components/dashboards/DashboardSetupPanel", () => ({
  DashboardSetupPanel: ({
    dashboard,
    onCreateLink,
  }: {
    dashboard: string;
    onCreateLink: () => void;
  }) => (
    <div>
      setup:{dashboard || "overview"}
      <button type="button" onClick={onCreateLink}>
        setup create link
      </button>
    </div>
  ),
}));
const { dialogMounts } = vi.hoisted(() => ({ dialogMounts: { n: 0 } }));
vi.mock("@/components/dashboards/WidgetDialog", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    WidgetDialog: ({
      open,
      defaultDashboardId,
      onOpenChange,
      onSubmit,
      filters,
    }: {
      open: boolean;
      defaultDashboardId?: number;
      filters: unknown[];
      onOpenChange: (o: boolean) => void;
      onSubmit: (s: { dashboardId?: number; payload: object }) => void;
    }) => {
      React.useEffect(() => {
        dialogMounts.n += 1;
      }, []);
      return open ? (
        <div data-testid="widget-editor">
          target:{String(defaultDashboardId)}
          <span data-testid="editor-filters">{JSON.stringify(filters)}</span>
          <button type="button" onClick={() => onOpenChange(false)}>
            Close editor
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                dashboardId: defaultDashboardId,
                payload: { metric: "installs" },
              })
            }
          >
            Submit widget
          </button>
        </div>
      ) : null;
    },
  };
});

import {
  useOverviewUserTrendsQuery,
  useOverviewKeyMetricsQuery,
} from "@/hooks/queries/useAnalyticsOverviewQueries";
import { useRetentionSummaryQuery } from "@/hooks/queries/useAnalyticsRetentionQueries";
import { useTopLinksQuery } from "@/hooks/queries/useDashboardQueries";
import { useCampaignsListQuery } from "@/hooks/queries/useCampaignsQueries";
import { useDashboardsQuery } from "@/hooks/queries/useDashboardsQueries";
import AnalyticsOverviewPage from "../AnalyticsOverviewPage";

const storedFilters = [{ field: "os", operator: "is", value: "iOS" }];
const board = {
  id: 5,
  name: "Growth",
  position: 0,
  created_at: "",
  updated_at: "",
  widgets: [],
};
const countryChip = `filters=${encodeURIComponent(JSON.stringify([{ f: "country", o: "is", v: "RO" }]))}`;

function expectOverviewEnabled(enabled: boolean) {
  expect(
    vi.mocked(useOverviewKeyMetricsQuery).mock.calls.length
  ).toBeGreaterThanOrEqual(2);
  expect(
    vi
      .mocked(useOverviewUserTrendsQuery)
      .mock.calls.every((c) => c[2] === enabled)
  ).toBe(true);
  expect(
    vi
      .mocked(useOverviewKeyMetricsQuery)
      .mock.calls.every((c) => c[2] === enabled)
  ).toBe(true);
  expect(
    vi
      .mocked(useRetentionSummaryQuery)
      .mock.calls.every((c) => c[2] === enabled)
  ).toBe(true);
  expect(
    vi
      .mocked(useTopLinksQuery)
      .mock.calls.every((c) => (c[1] !== null) === enabled)
  ).toBe(true);
  expect(
    vi
      .mocked(useCampaignsListQuery)
      .mock.calls.every((c) => (c[1] !== null) === enabled)
  ).toBe(true);
}

beforeEach(() => {
  overviewPrefs.mockReturnValue({ prefs: {}, remember: vi.fn(), loaded: true });
});

describe("AnalyticsOverviewPage board gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    overviewPrefs.mockReturnValue({
      prefs: {},
      remember: vi.fn(),
      loaded: true,
    });
    mockSearchParams = new URLSearchParams();
  });

  it("fires none of the overview queries while a deep-linked board's list loads", () => {
    mockSearchParams = new URLSearchParams("board=5");
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: undefined,
      isPending: true,
    } as never);
    render(<AnalyticsOverviewPage />);
    expectOverviewEnabled(false);
  });

  it("keeps them off while the board is shown", () => {
    mockSearchParams = new URLSearchParams("board=5");
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: [board],
      isPending: false,
    } as never);
    render(<AnalyticsOverviewPage />);
    expectOverviewEnabled(false);
  });

  it("runs them on the overview, including for an unknown board id", () => {
    mockSearchParams = new URLSearchParams("board=99");
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: [board],
      isPending: false,
    } as never);
    render(<AnalyticsOverviewPage />);
    expectOverviewEnabled(true);
  });
});

describe("AnalyticsOverviewPage banners", () => {
  const longFiltered = `from=${new Date("2026-01-01T00:00:00Z").toISOString()}&to=${new Date("2026-06-01T00:00:00Z").toISOString()}&filters=${encodeURIComponent(JSON.stringify([{ f: "country", o: "is", v: "RO" }]))}`;
  const title = "Headline metrics with filters are limited to 90 days";

  beforeEach(() => {
    vi.clearAllMocks();
    instance.current = { id: 1, get_started_dismissed: true };
    overviewPrefs.mockReturnValue({
      prefs: {},
      remember: vi.fn(),
      loaded: true,
    });
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: [board],
      isPending: false,
    } as never);
  });

  it("shows the 90-day headline notice on the overview", () => {
    mockSearchParams = new URLSearchParams(longFiltered);
    render(<AnalyticsOverviewPage />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("uses the plan's raw_max_days cap instead of 90", () => {
    instance.current = {
      id: 1,
      get_started_dismissed: true,
      analytics_retention: {
        plan: "enterprise",
        queryable_days: 3650,
        raw_max_days: 30,
      },
    };
    const from = new Date("2026-05-01T00:00:00Z").toISOString();
    const to = new Date("2026-06-15T00:00:00Z").toISOString();
    mockSearchParams = new URLSearchParams(
      `from=${from}&to=${to}&${countryChip}`
    );
    render(<AnalyticsOverviewPage />);
    expect(
      screen.getByText("Headline metrics with filters are limited to 30 days")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/use the 30-day filtered window/)
    ).toBeInTheDocument();
  });

  it("does not warn when the range is within a larger raw_max_days cap", () => {
    instance.current = {
      id: 1,
      get_started_dismissed: true,
      analytics_retention: {
        plan: "enterprise",
        queryable_days: 3650,
        raw_max_days: 366,
      },
    };
    mockSearchParams = new URLSearchParams(longFiltered);
    render(<AnalyticsOverviewPage />);
    expect(
      screen.queryByText(/Headline metrics with filters are limited/)
    ).not.toBeInTheDocument();
  });

  it("hides it on a board, where widgets carry their own limits", () => {
    mockSearchParams = new URLSearchParams(`${longFiltered}&board=5`);
    render(<AnalyticsOverviewPage />);
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  });
});

describe("AnalyticsOverviewPage widget dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    overviewPrefs.mockReturnValue({
      prefs: {},
      remember: vi.fn(),
      loaded: true,
    });
    mockSearchParams = new URLSearchParams("board=5");
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: [board],
      isPending: false,
      isSuccess: true,
    } as never);
    createWidgetMutateAsync.mockReset().mockResolvedValue(undefined);
    updateWidgetMutateAsync.mockReset().mockResolvedValue(undefined);
  });

  it("opens the create dialog targeting the active dashboard", async () => {
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    expect(await screen.findByTestId("widget-editor")).toHaveTextContent(
      "target:5"
    );
    expect(createDashboard).not.toHaveBeenCalled();
  });

  it("gives every editor session a fresh dialog instance", async () => {
    render(<AnalyticsOverviewPage />);
    const before = dialogMounts.n;
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    await userEvent.click(screen.getByRole("button", { name: "Close editor" }));
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    expect(screen.getByTestId("widget-editor")).toBeInTheDocument();
    // open #1, closed placeholder, open #2
    expect(dialogMounts.n - before).toBe(3);
  });

  it("adds a widget and shows a success notification", async () => {
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit widget" })
    );
    await waitFor(() =>
      expect(screen.queryByTestId("widget-editor")).toBeNull()
    );
    expect(createWidgetMutateAsync).toHaveBeenCalledWith({
      dashboardId: 5,
      payload: { metric: "installs" },
    });
    expect(showSuccessNotification).toHaveBeenCalledWith("Widget added");
  });

  it("shows the API's error message when creating a widget fails", async () => {
    createWidgetMutateAsync.mockRejectedValueOnce(new Error("boom"));
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit widget" })
    );
    await waitFor(() =>
      expect(showErrorNotification).toHaveBeenCalledWith(
        "Couldn't save the widget. Please try again."
      )
    );
    expect(showGenericError).not.toHaveBeenCalled();
    // The dialog stays open on failure so the user can retry.
    expect(screen.getByTestId("widget-editor")).toBeInTheDocument();
  });

  it("opens the edit dialog for an existing widget", async () => {
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "Edit widget" }));
    expect(await screen.findByTestId("widget-editor")).toBeInTheDocument();
  });

  it("starts a new widget with no filters of its own, even with page chips active", async () => {
    mockSearchParams = new URLSearchParams(`board=5&${countryChip}`);
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    expect((await screen.findByTestId("editor-filters")).textContent).toBe(
      "[]"
    );
  });

  it("edits a widget with its stored filters", async () => {
    mockSearchParams = new URLSearchParams(`board=5&${countryChip}`);
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "Edit widget" }));
    expect(await screen.findByTestId("editor-filters")).toHaveTextContent(
      JSON.stringify(storedFilters)
    );
  });
});

describe("AnalyticsOverviewPage remembers selections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: [],
      isPending: false,
      isSuccess: true,
    } as never);
  });

  it("restores metric, granularity and breakdown from prefs when the URL has none of them", () => {
    overviewPrefs.mockReturnValue({
      prefs: { metric: "installs", granularity: "week", breakdown: "city" },
      remember: vi.fn(),
      loaded: true,
    });
    render(<AnalyticsOverviewPage />);
    expect(urlSetterSpies.get("metric")).toHaveBeenCalledWith("installs");
    expect(urlSetterSpies.get("granularity")).toHaveBeenCalledWith("week");
    expect(urlSetterSpies.get("breakdown")).toHaveBeenCalledWith("city");
  });

  it("lets a metric already present in the URL win over prefs", () => {
    mockSearchParams = new URLSearchParams("metric=views");
    overviewPrefs.mockReturnValue({
      prefs: { metric: "installs", granularity: "week" },
      remember: vi.fn(),
      loaded: true,
    });
    render(<AnalyticsOverviewPage />);
    expect(urlSetterSpies.get("metric")).not.toHaveBeenCalled();
    // Unrelated keys absent from the URL still restore.
    expect(urlSetterSpies.get("granularity")).toHaveBeenCalledWith("week");
  });

  it("does nothing while prefs haven't loaded yet", () => {
    overviewPrefs.mockReturnValue({
      prefs: { metric: "installs" },
      remember: vi.fn(),
      loaded: false,
    });
    render(<AnalyticsOverviewPage />);
    expect(urlSetterSpies.get("metric")).not.toHaveBeenCalled();
  });

  it("remembers the breakdown metric override, timeline and compare from BreakdownPanel", async () => {
    const remember = vi.fn();
    overviewPrefs.mockReturnValue({ prefs: {}, remember, loaded: true });
    render(<AnalyticsOverviewPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Change breakdown" })
    );
    expect(remember).toHaveBeenCalledWith({
      breakdownMetric: { new_users: "views" },
      timeline: false,
      compare: true,
      top: 20,
    });
  });
});

describe("AnalyticsOverviewPage built-in dashboards", () => {
  let remember: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    sdkStatus.current = undefined;
    remember = vi.fn();
    overviewPrefs.mockReturnValue({ prefs: {}, remember, loaded: true });
    mockSearchParams = new URLSearchParams();
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: [board],
      isPending: false,
      isSuccess: true,
    } as never);
    copyDashboardMutateAsync.mockReset();
  });

  it("renders a built-in from ?board and keeps the overview queries off", () => {
    mockSearchParams = new URLSearchParams("board=acquisition");
    render(<AnalyticsOverviewPage />);
    expect(screen.getByText("builtin:Acquisition")).toBeInTheDocument();
    expectOverviewEnabled(false);
    expect(
      screen.getByRole("button", { name: /copy to customise/i })
    ).toBeInTheDocument();
  });

  it("shows only the date picker on Overview, no Copy to customise", () => {
    render(<AnalyticsOverviewPage />);
    expect(screen.queryByText(/^builtin:/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /copy to customise/i })
    ).toBeNull();
    expectOverviewEnabled(true);
  });

  it("remembers the dashboard picked", async () => {
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "pick:revenue" }));
    expect(urlSetterSpies.get("board")).toHaveBeenCalledWith("revenue");
    expect(remember).toHaveBeenCalledWith({ dashboard: "revenue" });
  });

  it("restores the last dashboard when the URL has no board", () => {
    overviewPrefs.mockReturnValue({
      prefs: { dashboard: "links" },
      remember,
      loaded: true,
    });
    render(<AnalyticsOverviewPage />);
    expect(urlSetterSpies.get("board")).toHaveBeenCalledWith("links");
  });

  it("lets ?board win over the remembered dashboard", () => {
    mockSearchParams = new URLSearchParams("board=acquisition");
    overviewPrefs.mockReturnValue({
      prefs: { dashboard: "links" },
      remember,
      loaded: true,
    });
    render(<AnalyticsOverviewPage />);
    expect(urlSetterSpies.get("board")).not.toHaveBeenCalled();
    expect(screen.getByText("builtin:Acquisition")).toBeInTheDocument();
  });

  it("holds the overview queries until the remembered dashboard is restored", () => {
    overviewPrefs.mockReturnValue({
      prefs: { dashboard: "links" },
      remember,
      loaded: false,
    });
    render(<AnalyticsOverviewPage />);
    expect(
      vi
        .mocked(useOverviewKeyMetricsQuery)
        .mock.calls.every((c) => c[2] === false)
    ).toBe(true);
  });

  const openCopy = async () => {
    await userEvent.click(
      screen.getByRole("button", { name: /copy to customise/i })
    );
    return screen.findByRole("dialog");
  };

  it("copies a built-in through the dialog and opens the new board with its hint", async () => {
    mockSearchParams = new URLSearchParams("board=links");
    copyDashboardMutateAsync.mockResolvedValue({
      dashboard: { id: 42 },
      failed: [],
    });
    render(<AnalyticsOverviewPage />);
    const dialog = await openCopy();
    expect(dialog).toHaveTextContent("Copy Links to your boards");
    await userEvent.click(screen.getByRole("button", { name: "Create board" }));
    await waitFor(() => expect(copyDashboardMutateAsync).toHaveBeenCalled());
    const arg = copyDashboardMutateAsync.mock.calls[0]![0];
    expect(arg.name).toBe("Links — my version");
    expect(arg.widgets.map((w: { title: string }) => w.title)).toEqual([
      "Key numbers",
      "Link views",
      "Views by country",
      "Top links",
      "Top campaigns",
    ]);
    await waitFor(() =>
      expect(urlSetterSpies.get("board")).toHaveBeenCalledWith("42")
    );
    expect(remember).toHaveBeenCalledWith({ dashboard: "42" });
    expect(window.localStorage.getItem("dashboards:ready-hint:42")).toBe("1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("explains the board limit in the dialog and blocks creating", async () => {
    mockSearchParams = new URLSearchParams("board=revenue");
    vi.mocked(useDashboardsQuery).mockReturnValue({
      data: Array.from({ length: 10 }, (_, i) => ({ ...board, id: i + 1 })),
      isPending: false,
      isSuccess: true,
    } as never);
    render(<AnalyticsOverviewPage />);
    await openCopy();
    expect(screen.getByRole("alert")).toHaveTextContent(/limit/);
    expect(screen.getByRole("button", { name: "Create board" })).toBeDisabled();
    expect(copyDashboardMutateAsync).not.toHaveBeenCalled();
  });

  it("shows the API error inside the dialog when copying fails", async () => {
    mockSearchParams = new URLSearchParams("board=revenue");
    copyDashboardMutateAsync.mockRejectedValue(new Error("boom"));
    render(<AnalyticsOverviewPage />);
    await openCopy();
    await userEvent.click(screen.getByRole("button", { name: "Create board" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't create the board. Please try again."
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("routes row clicks to the campaign page, link dialog and Explorer", async () => {
    mockSearchParams = new URLSearchParams("board=acquisition");
    render(<AnalyticsOverviewPage />);
    await userEvent.click(screen.getByRole("button", { name: "campaign row" }));
    expect(routerPush).toHaveBeenCalledWith("/dynamic_links/campaigns/12");
    await userEvent.click(screen.getByRole("button", { name: "link row" }));
    expect(openEditLinkDialog).toHaveBeenCalledWith({ id: "7" }, {});
    await userEvent.click(screen.getByRole("button", { name: "country row" }));
    expect(routerPush).toHaveBeenCalledWith("/analytics/event_log?x=1");
  });

  const status = {
    ios_seen_at: null,
    android_seen_at: null,
    web_seen_at: null,
    has_events: true,
    has_purchases: true,
    has_links: true,
  };

  it.each([
    ["", { has_events: false }, "overview"],
    ["acquisition", { has_events: false }, "acquisition"],
    ["engagement", { has_events: false }, "engagement"],
    ["revenue", { has_purchases: false }, "revenue"],
    ["links", { has_links: false }, "links"],
  ])(
    "shows the setup panel instead of %s when its data is missing",
    (key, missing, label) => {
      mockSearchParams = new URLSearchParams(key ? `board=${key}` : "");
      sdkStatus.current = { ...status, ...missing };
      render(<AnalyticsOverviewPage />);
      expect(screen.getByText(`setup:${label}`)).toBeInTheDocument();
      expect(screen.queryByText(/^builtin:/)).toBeNull();
      expectOverviewEnabled(false);
    }
  );

  it("shows the dashboard when its own data exists, even if other data is missing", () => {
    mockSearchParams = new URLSearchParams("board=acquisition");
    sdkStatus.current = { ...status, has_purchases: false, has_links: false };
    render(<AnalyticsOverviewPage />);
    expect(screen.getByText("builtin:Acquisition")).toBeInTheDocument();
  });

  it("falls back to the dashboard when sdk_status is unavailable", () => {
    sdkStatus.current = undefined;
    render(<AnalyticsOverviewPage />);
    expect(screen.queryByText(/^setup:/)).toBeNull();
    expectOverviewEnabled(true);
  });

  it("never shows a setup panel on a user's own board", () => {
    mockSearchParams = new URLSearchParams("board=5");
    sdkStatus.current = { ...status, has_events: false };
    render(<AnalyticsOverviewPage />);
    expect(screen.queryByText(/^setup:/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add widget" })
    ).toBeInTheDocument();
  });

  it("leaves the getting-started banner to the sidebar's guided setup", () => {
    instance.current = { id: 1, get_started_dismissed: false };
    render(<AnalyticsOverviewPage />);
    expect(screen.queryByText(/Get started with Grovs/)).toBeNull();
    instance.current = { id: 1, get_started_dismissed: true };
  });

  it("opens the create-link dialog from the Links setup panel", async () => {
    mockSearchParams = new URLSearchParams("board=links");
    sdkStatus.current = { ...status, has_links: false };
    render(<AnalyticsOverviewPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "setup create link" })
    );
    expect(openLinkDialog).toHaveBeenCalled();
  });
});
