import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GET } from "@/lib/api";
import { ApiError } from "@/lib/ApiError";
import type { PushCampaign } from "@ee/types/push";
import PushCampaignsPage from "../PushCampaignsPage";
import PushReportPage from "../PushReportPage";
import {
  draftCampaign,
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import { BOTH_CONFIGURED } from "@ee/lib/__tests__/fixtures";
import { inAppExperiment } from "@ee/lib/__tests__/inAppFixtures";
import type { Experiment } from "@ee/types/experiment";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const url = vi.hoisted(() => ({ status: null as string | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/push",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/useUrlState", () => ({
  useUrlState: (
    _k: string,
    initial: string,
    options?: { parse?: (v: string) => string }
  ) => [
    url.status !== null && options?.parse ? options.parse(url.status) : initial,
    vi.fn(),
  ],
}));
vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/lib/edition", () => ({ IS_ENTERPRISE: true }));
vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));
vi.mock("@/components/layout/app-header", () => ({
  default: () => <header aria-label="App header" />,
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedInstance: {
      id: "i1",
      name: "Acme",
      production: { id: "p1" },
      test: { id: "t1" },
    },
    projectType: "Production",
  }),
}));
vi.mock("@ee/components/push/PushCampaignDialog", () => ({
  default: ({
    open,
    campaignId,
  }: {
    open: boolean;
    campaignId?: string | null;
  }) =>
    open ? <div role="dialog" aria-label={`composer ${campaignId}`} /> : null,
}));
vi.mock("@ee/components/push/DeliveriesTable", () => ({ default: () => null }));
vi.mock("@ee/components/push/ContentSummary", () => ({ default: () => null }));
vi.mock("@ee/components/push/PushExperimentCard", () => ({
  default: () => <section aria-label="Experiment card" />,
}));

let campaigns: PushCampaign[];
let configurations: unknown[];
let experiment: Experiment | (() => Promise<never>);

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  url.status = null;
  campaigns = [
    draftCampaign({ id: "d1", name: "Draft one" }),
    draftCampaign({ id: "s1", name: "Sent one", status: "sent" }),
  ];
  configurations = BOTH_CONFIGURED;
  experiment = inAppExperiment();
  vi.mocked(GET).mockImplementation(async (path: string) => {
    if (path.includes("/experiment"))
      return typeof experiment === "function"
        ? experiment()
        : ok({ experiment });
    if (path.endsWith("/instances/i1/configurations"))
      return ok({ configurations });
    if (path.includes("/segments"))
      return ok({ segments: [], truncated: false });
    if (path.includes("/in_app_settings"))
      return ok({
        in_app_settings: {
          enabled: true,
          session_cap: 10,
          day_cap: 10,
          control_group: 0,
        },
      });
    const one = campaigns.find((c) => path.endsWith(`/push_campaigns/${c.id}`));
    if (one) return ok({ push_campaign: one });
    return ok({ push_campaigns: campaigns, truncated: false });
  });
});

const openRow = async (name: string) =>
  userEvent.click(
    await screen.findByRole("button", { name: `Open push campaign ${name}` })
  );

describe("push list row open", () => {
  it("opens the composer on a draft", async () => {
    wrap(<PushCampaignsPage />);
    await openRow("Draft one");
    expect(
      screen.getByRole("dialog", { name: "composer d1" })
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates to the report for a sent campaign", async () => {
    wrap(<PushCampaignsPage />);
    await openRow("Sent one");
    expect(router.push).toHaveBeenCalledWith("/push/s1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the composer on a member's draft too, with New campaign", async () => {
    wrap(<PushCampaignsPage />);
    await openRow("Draft one");
    expect(
      screen.getByRole("dialog", { name: "composer d1" })
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "New campaign" })
    ).toBeInTheDocument();
  });
});

describe("push report deep link", () => {
  it("opens the composer over a draft's report", async () => {
    wrap(<PushReportPage campaignId="d1" />);
    expect(
      await screen.findByRole("dialog", { name: "composer d1" })
    ).toBeInTheDocument();
  });

  it("opens it for a member too", async () => {
    wrap(<PushReportPage campaignId="d1" />);
    expect(
      await screen.findByRole("dialog", { name: "composer d1" })
    ).toBeInTheDocument();
  });

  it("does not open it for a sent campaign", async () => {
    wrap(<PushReportPage campaignId="s1" />);
    await screen.findByRole("heading", { name: "Sent one" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});

describe("push list status filter and errors", () => {
  const listPaths = () =>
    vi
      .mocked(GET)
      .mock.calls.map(([path]) => String(path))
      .filter((path) => /\/push_campaigns(\?|$)/.test(path));

  it("falls back to all for an unknown ?status=", async () => {
    url.status = "bogus";
    wrap(<PushCampaignsPage />);
    await screen.findByRole("button", { name: "Open push campaign Draft one" });
    expect(listPaths()).toEqual([
      "/api/v1/projects/p1/push_campaigns?limit=50",
    ]);
  });

  it("keeps a known ?status=", async () => {
    url.status = "sent";
    wrap(<PushCampaignsPage />);
    await waitFor(() =>
      expect(listPaths()).toEqual([
        "/api/v1/projects/p1/push_campaigns?status=sent&limit=50",
      ])
    );
  });

  it("shows the unavailable notice only for a not-enabled 404", async () => {
    vi.mocked(GET).mockRejectedValue(
      new ApiError("Push campaigns are not enabled", 404)
    );
    wrap(<PushCampaignsPage />);
    expect(
      await screen.findByRole("heading", {
        name: "Push campaigns are not enabled",
      })
    ).toBeInTheDocument();
  });

  it("shows any other 404 as a normal error", async () => {
    vi.mocked(GET).mockRejectedValue(new ApiError("Not found", 404));
    wrap(<PushCampaignsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found");
    expect(screen.queryByText("No push campaigns yet")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Push campaigns" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Push campaigns are not enabled" })
    ).not.toBeInTheDocument();
  });
});

describe("cancel confirmation while sending", () => {
  const SENDING_NOTE =
    "Pushes already handed to Apple or Google will still go out.";

  beforeEach(() => {
    campaigns = [
      draftCampaign({ id: "g1", name: "Going out", status: "sending" }),
    ];
  });

  it("warns on the list row menu", async () => {
    wrap(<PushCampaignsPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Going out" })
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Cancel this campaign?",
    });
    expect(dialog).toHaveTextContent(SENDING_NOTE);
  });

  it("warns on the report page", async () => {
    wrap(<PushReportPage campaignId="g1" />);
    await screen.findByRole("heading", { name: "Going out" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Cancel this campaign?",
    });
    expect(dialog).toHaveTextContent(SENDING_NOTE);
  });
});

describe("cancelling the rest", () => {
  it("offers Cancel while the rest wait, with its own words", async () => {
    const one = draftCampaign({
      id: "w1",
      name: "Waiting one",
      status: "sent",
      started_at: "2026-09-23T08:00:00Z",
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      test_share: 20,
    });
    campaigns = [{ ...one, report: { ...one.report, waiting: 3120 } }];
    wrap(<PushReportPage campaignId="w1" />);
    await screen.findByRole("heading", { name: "Waiting one" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Cancel the rest?",
    });
    expect(dialog).toHaveTextContent(
      "The people waiting will not receive the push."
    );
    expect(
      within(dialog).getByRole("button", { name: "Cancel the rest" })
    ).toBeInTheDocument();
  });

  it("offers a member Duplicate and Cancel too", async () => {
    const one = draftCampaign({
      id: "w1",
      name: "Waiting one",
      status: "sent",
      started_at: "2026-09-23T08:00:00Z",
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      test_share: 20,
    });
    campaigns = [{ ...one, report: { ...one.report, waiting: 3120 } }];
    wrap(<PushReportPage campaignId="w1" />);
    await screen.findByRole("heading", { name: "Waiting one" });
    expect(
      screen.getByRole("button", { name: "Duplicate" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not offer Cancel on a plain sent campaign, or once the winner went out", async () => {
    campaigns = [draftCampaign({ id: "s1", status: "sent", winner: "b" })];
    wrap(<PushReportPage campaignId="s1" />);
    await screen.findByRole("heading", { name: "Spring" });
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});

describe("a goal alone", () => {
  it("still shows the experiment card", async () => {
    campaigns = [
      draftCampaign({
        id: "g1",
        status: "sent",
        started_at: "2026-09-23T08:00:00Z",
        conversion: { event: "checkout", window_hours: 24 },
      }),
    ];
    wrap(<PushReportPage campaignId="g1" />);
    expect(
      await screen.findByRole("region", { name: "Experiment card" })
    ).toBeInTheDocument();
  });
});

describe("report loading", () => {
  it("shows a skeleton in the report's shape while the campaign loads", () => {
    vi.mocked(GET).mockImplementation(() => new Promise(() => {}) as never);
    wrap(<PushReportPage campaignId="s1" />);
    expect(screen.getByLabelText("Loading push campaign")).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });
});

describe("an experiment on the report", () => {
  it("shows the held and waiting rows, the header line and the card", async () => {
    const one = draftCampaign({
      id: "s1",
      name: "Sent one",
      status: "sent",
      started_at: "2026-09-23T10:00:00Z",
      control_group: 10,
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      test_share: 20,
    });
    campaigns = [
      { ...one, report: { ...one.report, held: 4120, waiting: 3120 } },
    ];
    wrap(<PushReportPage campaignId="s1" />);
    expect(
      await screen.findByText("Sent to the test share")
    ).toBeInTheDocument();
    const reach = screen.getByRole("region", { name: "Reach" });
    expect(within(reach).getByText("Control group")).toBeInTheDocument();
    expect(within(reach).getByText("4,120")).toBeInTheDocument();
    expect(
      within(reach).getByText("Waiting for the winner")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Experiment card" })
    ).toBeInTheDocument();
  });

  const timed = () => {
    const one = draftCampaign({
      id: "s1",
      status: "sent",
      started_at: "2026-09-23T08:00:00Z",
      variants: [{ id: "b", title: "Hi", body: "Sale on" }],
      test_share: 20,
      winner_after_minutes: 120,
      winner_by: "opens",
      winner_due_at: "2026-09-23T12:00:00Z",
    });
    return { ...one, report: { ...one.report, waiting: 3120 } };
  };

  it("a banner counts down by the second, names the leader and sends it", async () => {
    vi.useFakeTimers({
      now: new Date("2026-09-23T10:08:17Z"),
      shouldAdvanceTime: true,
    });
    campaigns = [timed()];
    wrap(<PushReportPage campaignId="s1" />);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("3,120 people are waiting for the winner");
    expect(banner).toHaveTextContent(
      /Goes out automatically in 1 h 51 min 4\d s \(at 23 Sep 2026, \d\d:00\)/
    );
    await screen.findByText("Judged by opens · B leads: 17.1% vs 14.8%");
    expect(screen.getByText("Sent to the test share")).toBeInTheDocument();
    expect(screen.getAllByText("Waiting for the winner")).toHaveLength(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Send B to the rest now" })
    );
    expect(
      await screen.findByRole("dialog", {
        name: "Send variant B to the 3,120 people waiting?",
      })
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("the timer sends A unless every variant reaches 100 people", async () => {
    experiment = inAppExperiment({
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, exposed: 60 } : g
      ),
    });
    campaigns = [timed()];
    wrap(<PushReportPage campaignId="s1" />);
    await screen.findByText(
      "Judged by opens · B leads: 17.1% vs 14.8% · A goes out unless every variant reaches 100 people"
    );
  });

  it("without a timer the banner asks, and a tie goes to A", async () => {
    experiment = inAppExperiment({
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, click_rate: 0.148 } : g
      ),
    });
    campaigns = [
      {
        ...timed(),
        winner_after_minutes: null,
        winner_by: null,
        winner_due_at: null,
      },
    ];
    wrap(<PushReportPage campaignId="s1" />);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent(
      "3,120 people are waiting for you to pick the winner"
    );
    expect(banner).toHaveTextContent("Waiting for you to pick the winner");
    await screen.findByText(
      "Judged by opens · A and B are tied; a tie goes to A"
    );
    expect(
      screen.getByRole("button", { name: "Send A to the rest" })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Choose a variant" })
    ).toBeInTheDocument();
  });

  it("a member can send the winner too", async () => {
    campaigns = [
      {
        ...timed(),
        winner_after_minutes: null,
        winner_by: null,
        winner_due_at: null,
      },
    ];
    wrap(<PushReportPage campaignId="s1" />);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Waiting for you to pick the winner");
    await screen.findByText(/^Judged by opens · B leads/);
    expect(
      screen.getByRole("button", { name: "Send B to the rest" })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Choose a variant" })
    ).toBeInTheDocument();
  });

  it("while the experiment loads, the send button waits for data", async () => {
    experiment = () => new Promise(() => undefined);
    campaigns = [timed()];
    wrap(<PushReportPage campaignId="s1" />);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Judged by opens");
    expect(banner).not.toHaveTextContent("leads");
    const send = screen.getByRole("button", {
      name: "Send the leader to the rest now",
    });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("title", "Waiting for data");
  });

  it("says which variant went out, then that it was sent", async () => {
    const one = timed();
    campaigns = [
      { ...one, status: "sending", winner: "b", winner_due_at: null },
    ];
    const going = wrap(<PushReportPage campaignId="s1" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Variant B is going out to the rest…"
    );
    going.unmount();
    campaigns = [
      {
        ...one,
        winner: "b",
        winner_due_at: null,
        report: { ...one.report, waiting: 0 },
      },
    ];
    wrap(<PushReportPage campaignId="s1" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Variant B was sent to the rest automatically."
    );
    expect(screen.getByText(/^Sent 23 Sep/)).toBeInTheDocument();
    expect(screen.queryByText("Waiting for the winner")).toBeNull();
  });

  it("shows neither the rows nor the card without one", async () => {
    campaigns = [
      draftCampaign({
        id: "s1",
        status: "sent",
        started_at: "2026-09-23T10:00:00Z",
      }),
    ];
    wrap(<PushReportPage campaignId="s1" />);
    await screen.findByText(/^Sent /);
    const reach = screen.getByRole("region", { name: "Reach" });
    expect(within(reach).queryByText("Control group")).toBeNull();
    expect(within(reach).queryByText("Waiting for the winner")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Experiment card" })
    ).toBeNull();
  });
});

describe("push setup notices", () => {
  it("keeps past campaigns but hides New campaign when nothing is configured", async () => {
    configurations = [];
    wrap(<PushCampaignsPage />);
    expect(
      await screen.findByText("Set up push notifications")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("href", "/settings/developers/android_setup");
    expect(screen.getByText("Sent one")).toBeInTheDocument();
  });

  it("hides New campaign while nothing is configured", async () => {
    configurations = [];
    wrap(<PushCampaignsPage />);
    await screen.findByText("Set up push notifications");
    expect(
      screen.queryByRole("button", { name: "New campaign" })
    ).not.toBeInTheDocument();
  });

  it("replaces an empty list with the onboarding when nothing is configured", async () => {
    configurations = [];
    campaigns = [];
    wrap(<PushCampaignsPage />);
    expect(
      await screen.findByRole("heading", {
        name: "Connect a platform to send push campaigns",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Set up iOS push" })
    ).toHaveAttribute("href", "/settings/developers/ios_setup");
    expect(
      screen.getByRole("link", { name: "Set up Android push" })
    ).toHaveAttribute("href", "/settings/developers/android_setup");
    expect(screen.queryByText("No push campaigns yet")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New campaign" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("keeps the page header while the onboarding shows", async () => {
    configurations = [];
    campaigns = [];
    wrap(<PushCampaignsPage />);
    await screen.findByRole("heading", {
      name: "Connect a platform to send push campaigns",
    });
    expect(screen.getByLabelText("App header")).toBeInTheDocument();
  });

  it("shows the normal empty state when push is set up", async () => {
    campaigns = [];
    wrap(<PushCampaignsPage />);
    expect(
      await screen.findByText("No push campaigns yet")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Connect a platform to send push campaigns",
      })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("App header")).toBeInTheDocument();
  });

  it("does not fetch the push setup when push is not enabled", async () => {
    vi.mocked(GET).mockImplementation(async (path: string) => {
      if (path.includes("/push_campaigns"))
        throw new ApiError("Push campaigns are not enabled", 404);
      return ok({ configurations: [], segments: [], truncated: false });
    });
    wrap(<PushCampaignsPage />);
    await screen.findByRole("heading", {
      name: "Push campaigns are not enabled",
    });
    expect(
      vi
        .mocked(GET)
        .mock.calls.some(([path]) => String(path).includes("/configurations"))
    ).toBe(false);
  });

  it("shows the compact row on the list when one platform is missing", async () => {
    configurations = [(BOTH_CONFIGURED as unknown[])[1]];
    wrap(<PushCampaignsPage />);
    const row = await screen.findByRole("note", {
      name: "iOS push isn't configured",
    });
    expect(row).toHaveTextContent(
      "iOS push isn't configured — iOS devices won't receive campaigns."
    );
    expect(
      within(row).getByRole("link", { name: "Set up iOS push" })
    ).toHaveAttribute("href", "/settings/developers/ios_setup");
    expect(screen.queryByText("Set up push notifications")).toBeNull();
  });

  it("shows no notice on the list when both platforms are set up", async () => {
    wrap(<PushCampaignsPage />);
    await screen.findByRole("button", { name: "Open push campaign Draft one" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("labels no_app failures and shows the notice on the report", async () => {
    configurations = [(BOTH_CONFIGURED as unknown[])[0]];
    const sent = draftCampaign({ id: "s1", name: "Sent one", status: "sent" });
    campaigns = [
      {
        ...sent,
        report: { ...sent.report, failed: 4, error_counts: { no_app: 4 } },
      },
    ];
    wrap(<PushReportPage campaignId="s1" />);
    expect(
      await screen.findByText("Push not configured for this platform")
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("note", {
        name: "Android push isn't configured",
      })
    ).toBeInTheDocument();
  });

  it("shows no report notice without no_app failures", async () => {
    configurations = [];
    wrap(<PushReportPage campaignId="s1" />);
    await screen.findByRole("heading", { name: "Sent one" });
    expect(
      screen.queryByText("Set up push notifications")
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(GET)
        .mock.calls.some(([path]) => String(path).includes("/configurations"))
    ).toBe(false);
  });
});
