import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Uses the real useOverviewPrefs, useUrlState and BreakdownPanel; only their leaves are mocked.
let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn() }),
}));

const { useProjectSelectionMock } = vi.hoisted(() => ({
  useProjectSelectionMock: vi.fn(),
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: useProjectSelectionMock,
}));

vi.mock("@/context/useLinkDialogContext", () => ({
  useGlobalLinkDialog: () => ({
    openLinkDialog: vi.fn(),
    openEditLinkDialog: vi.fn(),
  }),
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
vi.mock("@/hooks/mutations/useDashboardsMutations", () => {
  const m = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useCreateDashboardMutation: m,
    useUpdateDashboardMutation: m,
    useCreateWidgetMutation: m,
    useUpdateWidgetMutation: m,
    useCopyDashboardMutation: m,
  };
});
vi.mock("@/hooks/queries/useSdkStatusQuery", () => ({
  useSdkStatusQuery: () => ({ data: undefined, refetch: vi.fn() }),
}));
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
  useDashboardsQuery: vi.fn(() => ({
    data: [],
    isPending: false,
    isSuccess: true,
  })),
}));
vi.mock("@/components/layout/app-header", () => ({ default: () => null }));
vi.mock("@/components/analytics/events/QueryBar", () => ({
  default: () => null,
}));
vi.mock("@/components/dateRangePicker/DateRangePicker", () => ({
  DateRangePicker: () => null,
}));
vi.mock("../OverviewKeyMetrics", () => ({
  METRIC_KEYS: ["new_users", "installs"],
  OverviewKeyMetrics: () => null,
}));
vi.mock("../OverviewMetricGroups", () => ({
  OverviewMetricGroups: () => null,
}));
vi.mock("../AcquisitionChannels", () => ({ AcquisitionChannels: () => null }));
vi.mock("../OverviewTopList", () => ({ OverviewTopList: () => null }));
vi.mock("@/components/dashboards/DashboardBoard", () => ({
  DashboardBoard: () => null,
}));
vi.mock("@/components/dashboards/WidgetDialog", () => ({
  WidgetDialog: () => null,
}));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification: vi.fn(),
  showGenericError: vi.fn(),
  showSuccessNotification: vi.fn(),
}));

// BreakdownPanel's own leaf dependencies (same as BreakdownPanel.test.tsx).
vi.mock("@/hooks/queries/useMetricQuery", () => ({ useMetricQuery: vi.fn() }));
vi.mock("@/hooks/queries/useAnalyticsEventsQueries", () => ({
  useAnalyticsEventFieldsQuery: vi.fn(() => ({ data: undefined })),
}));

import { useMetricQuery } from "@/hooks/queries/useMetricQuery";
import AnalyticsOverviewPage from "../AnalyticsOverviewPage";

const projectSelection = (id: string) => ({
  selectedProject: { id },
  selectedInstance: { id: 1, get_started_dismissed: true },
  getStartedSetup: null,
});

describe("AnalyticsOverviewPage prefs — bug reproductions with the real hook", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockSearchParams = new URLSearchParams();
    useProjectSelectionMock.mockReturnValue(projectSelection("p1"));
    vi.mocked(useMetricQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
  });

  it("seeds BreakdownPanel's timeline/compare/metric override once prefs load, not before", async () => {
    // Set the card directly through the URL so this is isolated from the metric-restore path.
    mockSearchParams = new URLSearchParams("metric=installs");
    window.localStorage.setItem(
      "overview:prefs:p1",
      JSON.stringify({
        timeline: true,
        compare: false,
        breakdownMetric: { installs: "events" },
      })
    );

    render(<AnalyticsOverviewPage />);

    expect(
      await screen.findByRole("combobox", { name: "View" })
    ).toHaveTextContent("Timeline");
    expect(screen.getByRole("combobox", { name: "Compare" })).toHaveTextContent(
      "No previous period"
    );
    // The remembered override, not the card default from before prefs arrived.
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "events" }),
      true
    );
    // The panel must not mount (and query) with the card's default before prefs arrive.
    expect(useMetricQuery).not.toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ metric: "installs" }),
      true
    );
  });

  it("doesn't corrupt the new project's remembered breakdown when switching projects", async () => {
    window.localStorage.setItem(
      "overview:prefs:p1",
      JSON.stringify({ breakdown: "country" })
    );
    window.localStorage.setItem(
      "overview:prefs:p2",
      JSON.stringify({ breakdown: "city" })
    );

    const { rerender } = render(<AnalyticsOverviewPage />);
    await screen.findByRole("combobox", { name: "Dimension" });

    useProjectSelectionMock.mockReturnValue(projectSelection("p2"));
    rerender(<AnalyticsOverviewPage />);

    await waitFor(() =>
      expect(window.location.search).toContain("breakdown=city")
    );
    expect(
      JSON.parse(window.localStorage.getItem("overview:prefs:p2")!)
    ).toEqual({ breakdown: "city" });
    // p1's own remembered prefs must be untouched too.
    expect(
      JSON.parse(window.localStorage.getItem("overview:prefs:p1")!)
    ).toEqual({ breakdown: "country" });
  });

  it("doesn't re-write storage once the URL catches up to what's already remembered", async () => {
    window.localStorage.setItem(
      "overview:prefs:p1",
      JSON.stringify({ breakdown: "city" })
    );
    const { rerender } = render(<AnalyticsOverviewPage />);
    await screen.findByRole("combobox", { name: "Dimension" });

    // The URL catches up to the restored value, as Next's history patch does in production.
    mockSearchParams = new URLSearchParams("breakdown=city");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    rerender(<AnalyticsOverviewPage />);

    expect(setItemSpy).not.toHaveBeenCalledWith(
      "overview:prefs:p1",
      expect.anything()
    );
  });
});
