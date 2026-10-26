import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GET, PATCH, POST } from "@/lib/api";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import {
  bannerText,
  goalVerdict,
} from "@ee/components/journeys/report/JourneyStatusBanner";
import { ApiError } from "@/lib/ApiError";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import {
  abDraft,
  journey,
  journeyReport,
  pathExperiment,
} from "@ee/lib/__tests__/journeyFixtures";
import type { Journey, PercentSplitStep } from "@ee/types/journey";
import JourneysPage from "../JourneysPage";
import JourneyReportPage, { goalText } from "../JourneyReportPage";
import { format } from "date-fns";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/journeys",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/useUrlState", () => ({
  useUrlState: (_k: string, initial: string) => [initial, vi.fn()],
}));
vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));
vi.mock("@/lib/edition", () => ({
  IS_ENTERPRISE: true,
  IS_SELF_HOSTED: false,
}));
vi.mock("@/context/useLinkDialogContext", () => ({
  useGlobalLinkDialog: () => ({ openLinkDialog: vi.fn() }),
}));
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
vi.mock("@ee/hooks/queries/useInAppSuggestions", () => ({
  useInAppSuggestions: () => ({
    loading: false,
    userAttributes: [],
    eventProperties: [],
  }),
}));

// The page shows local time, so the expectation follows the runner's time zone.
const LAUNCHED = format(
  new Date("2026-09-20T10:00:00.000Z"),
  "d MMM yyyy, HH:mm"
);

const live = journey({
  id: "live-1",
  name: "Cart recovery",
  status: "live",
  launched_at: "2026-09-20T10:00:00.000Z",
  stats: { active: 1204, entered: 5310 },
});
const draft = journey({ id: "draft-1", name: "Welcome" });
let rows: Journey[];
let listError: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  polyfillDom();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
  rows = [live, draft];
  listError = null;
  vi.mocked(GET).mockImplementation((async (path: string) => {
    if (path.includes("/segments"))
      return ok({ segments: [], truncated: false });
    if (path.includes("/report")) return ok({ report: journeyReport() });
    if (/\/journeys(\?|$)/.test(path)) {
      if (listError) throw listError;
      return ok({ journeys: rows, truncated: false, next_after: null });
    }
    if (path.includes("/journeys/live-1")) return ok({ journey: live });
    if (path.includes("/journeys/draft-1")) return ok({ journey: draft });
    return ok({});
  }) as never);
  vi.mocked(POST).mockImplementation((async () =>
    ok({ journey: { ...live, status: "paused" } })) as never);
  vi.mocked(PATCH).mockImplementation((async (_path: string, body: unknown) =>
    ok({
      journey: { ...live, ...(body as object), lock_version: 1 },
    })) as never);
});

describe("JourneysPage", () => {
  it("lists journeys with their numbers and opens a live one's report", async () => {
    wrap(<JourneysPage />);
    const table = await screen.findByRole("table", { name: "Journeys" });
    expect(await within(table).findByText("Cart recovery")).toBeInTheDocument();
    expect(within(table).getByText("5,310")).toBeInTheDocument();
    expect(within(table).getByText("1,204")).toBeInTheDocument();
    expect(within(table).getByText("Not launched")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Open journey Cart recovery" })
    );
    expect(push).toHaveBeenCalledWith("/journeys/live-1");
  });

  it("opens a draft in the editor", async () => {
    wrap(<JourneysPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Open journey Welcome" })
    );
    expect(
      await screen.findByRole("heading", { name: "Edit journey" })
    ).toBeInTheDocument();
  });

  it("pauses from the row menu", async () => {
    wrap(<JourneysPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Cart recovery" })
    );
    expect(
      screen.queryByRole("menuitem", { name: "Delete" })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Pause" }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        "/api/v1/projects/p1/journeys/live-1/pause",
        {},
        expect.anything()
      )
    );
  });

  it("a member can pause from the row menu too", async () => {
    wrap(<JourneysPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Cart recovery" })
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Pause" }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        "/api/v1/projects/p1/journeys/live-1/pause",
        {},
        expect.anything()
      )
    );
  });

  it("explains journeys when there are none", async () => {
    rows = [];
    wrap(<JourneysPage />);
    expect(await screen.findByText("No journeys yet")).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "New journey" })[1]!
    );
    const chooser = await screen.findByRole("dialog", {
      name: "Start a journey",
    });
    await userEvent.click(
      within(chooser).getByRole("button", { name: /Cart recovery/ })
    );
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        "/api/v1/projects/p1/journeys",
        expect.objectContaining({
          name: "Cart recovery",
          goals: [{ event: "checkout_completed", window_hours: 168 }],
        }),
        expect.anything()
      )
    );
    expect(
      await screen.findByRole("heading", { name: "Create journey" })
    ).toBeInTheDocument();
  });

  it("keeps the chooser open with a notice when the draft cannot be made", async () => {
    rows = [];
    vi.mocked(POST).mockRejectedValue(
      new ApiError("Invalid", 422, undefined, {
        error: "Entry event needs exactly one of name, screen or system",
      })
    );
    wrap(<JourneysPage />);
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "New journey" }))[0]!
    );
    const chooser = await screen.findByRole("dialog", {
      name: "Start a journey",
    });
    await userEvent.click(
      within(chooser).getByRole("button", { name: /Welcome series/ })
    );
    await waitFor(() =>
      expect(showErrorNotification).toHaveBeenCalledWith(
        "Entry event needs exactly one of name, screen or system"
      )
    );
    expect(
      screen.getByRole("dialog", { name: "Start a journey" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Back to journeys/)).not.toBeInTheDocument();
  });

  it("loads the next page when the end of the list comes into view", async () => {
    let seen: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          seen = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      }
    );
    vi.mocked(GET).mockImplementation((async (path: string) => {
      if (/\/journeys\?.*after=c1/.test(path))
        return ok({ journeys: [draft], truncated: false, next_after: null });
      if (/\/journeys(\?|$)/.test(path))
        return ok({ journeys: [live], truncated: false, next_after: "c1" });
      return ok({ segments: [], truncated: false });
    }) as never);
    wrap(<JourneysPage />);
    const table = await screen.findByRole("table", { name: "Journeys" });
    expect(await within(table).findByText("Cart recovery")).toBeInTheDocument();
    expect(within(table).queryByText("Welcome")).not.toBeInTheDocument();
    seen(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
    expect(await within(table).findByText("Welcome")).toBeInTheDocument();
    expect(
      vi
        .mocked(GET)
        .mock.calls.some(([path]) => String(path).includes("after=c1"))
    ).toBe(true);
  });

  it("says when journeys are off for the project", async () => {
    listError = new ApiError("Journeys are not enabled", 404, undefined, {
      error: "Journeys are not enabled",
    });
    wrap(<JourneysPage />);
    expect(
      await screen.findByText("Journeys are not enabled for this project.")
    ).toBeInTheDocument();
  });
});

describe("JourneyReportPage", () => {
  it("shows totals, the goal, and the map with counts and channel links", async () => {
    wrap(<JourneyReportPage journeyId="live-1" />);
    expect(
      await screen.findByRole("heading", { name: "Cart recovery" })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("4,720", { selector: "p" })
    ).toBeInTheDocument();
    expect(screen.getByText("In the journey")).toBeInTheDocument();
    expect(screen.getByText("Goal: checkout_completed")).toBeInTheDocument();
    expect(screen.getAllByText(/· In the journey 90%/)).toHaveLength(2);
    expect(screen.getByText("Did it · 1,480")).toBeInTheDocument();
    expect(screen.getByText("Time ran out · 2,420")).toBeInTheDocument();
    const push = screen.getByLabelText("2. Send push");
    expect(push).toHaveTextContent("Reached 2,420");
    expect(
      within(push).getByRole("link", { name: /Push report/ })
    ).toHaveAttribute("href", "/push/pc-s2");
    expect(
      within(screen.getByLabelText("4. Show in-app")).getByRole("link")
    ).toHaveAttribute("href", "/in_app/ia-s4");
    expect(
      screen.queryByRole("button", { name: /^Add a step/ })
    ).not.toBeInTheDocument();
    for (const action of ["Edit", "Duplicate", "Pause", "End"])
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
  });

  it("asks before ending", async () => {
    wrap(<JourneyReportPage journeyId="live-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "End" }));
    expect(
      await screen.findByRole("dialog", { name: "End this journey?" })
    ).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
  });
});

describe("JourneyReportPage v2", () => {
  const withJourney = (j: Journey, report?: unknown) =>
    vi.mocked(GET).mockImplementation((async (path: string) => {
      if (path.includes("/segments"))
        return ok({ segments: [], truncated: false });
      if (path.includes("/in_app_settings"))
        return ok({
          in_app_settings: {
            enabled: true,
            session_cap: 1,
            day_cap: 1,
            control_group: 5,
          },
        });
      if (path.includes("/report")) {
        if (report instanceof Error) throw report;
        return ok({ report: report ?? journeyReport() });
      }
      return ok({ journey: j });
    }) as never);

  it("reads like the other reports: header line, banner, tiles, steps table and setup", async () => {
    withJourney({
      ...live,
      entry: { ...live.entry, event: { system: "install" } },
    });
    wrap(<JourneyReportPage journeyId="live-1" />);
    expect(
      await screen.findByText(
        `Launched ${LAUNCHED} · revision 1 · started on App installed`
      )
    ).toBeInTheDocument();
    const banner = await screen.findByText(/people are in the journey now/);
    expect(banner).toHaveTextContent(
      "1,204 people are in the journey now · 4,720 entered in the period · converts 41% better than the control (99% confidence)"
    );
    expect(
      screen.getByText("14.8% of people in the journey")
    ).toBeInTheDocument();
    expect(
      screen.getByText("700 reached a goal · 3,200 finished · 206 over 90 days")
    ).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Steps" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent("Did it 1,480");
    expect(
      within(rows[2]!).getByRole("link", { name: /Push report/ })
    ).toHaveAttribute("href", "/push/pc-s2");
    expect(screen.getAllByText("When someone installs the app")).toHaveLength(
      2
    );
    expect(screen.getByText(/Project control group 5%/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit entry" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Entry: Fixed at launch so the results stay comparable. Duplicate the journey to change it."
      )
    ).toBeInTheDocument();
  });

  it("a member gets Resume, End and Edit on a paused journey's report", async () => {
    withJourney({ ...live, status: "paused" });
    wrap(<JourneyReportPage journeyId="live-1" />);
    await screen.findByText(/^Paused:/);
    expect(screen.getAllByRole("button", { name: "Resume" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "End" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("offers Resume on a paused journey and Edit on a draft", async () => {
    withJourney({ ...live, status: "paused" });
    const { unmount } = wrap(<JourneyReportPage journeyId="live-1" />);
    expect(
      await screen.findByText(
        "Paused: nobody moves or enters until you resume. 1,204 people are waiting where they are."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Resume" })).toHaveLength(2);
    unmount();
    withJourney(draft);
    wrap(<JourneyReportPage journeyId="draft-1" />);
    expect(
      await screen.findByText("Draft, never launched")
    ).toBeInTheDocument();
    expect(screen.getByText("Draft: not live yet.")).toBeInTheDocument();
    expect(screen.queryByText("Results")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit goals" }));
    expect(
      await screen.findByRole("complementary", { name: "Leaves when" })
    ).toBeInTheDocument();
  });

  it("says when the results cannot be read, and when nobody entered yet", async () => {
    withJourney(
      live,
      new ApiError("unavailable", 503, "clickhouse_unavailable")
    );
    const { unmount } = wrap(<JourneyReportPage journeyId="live-1" />);
    expect(
      await screen.findByText(
        "The results cannot be read right now. Try again in a minute."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
    unmount();
    withJourney(live, journeyReport({ entered: 0, active: 0, held: 0 }));
    wrap(<JourneyReportPage journeyId="live-1" />);
    expect(
      await screen.findByText(
        "Nobody has entered yet. People enter when someone does add_to_cart."
      )
    ).toBeInTheDocument();
  });

  it("converts against entered, which already leaves out the held-back people", async () => {
    withJourney(
      live,
      journeyReport({
        entered: 1000,
        held: 250,
        left: { finished: 0, goal: 100, expired: 0 },
      })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    expect(
      await screen.findByText("10.0% of people in the journey")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/In the journey 90% \(1,125\)/)
    ).toBeInTheDocument();
  });

  it("shows an A/B split card with path labels and a leader sentence", async () => {
    withJourney(
      { ...live, ...abDraft() },
      journeyReport({ paths: { a: pathExperiment() } })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    const card = await screen.findByRole("region", {
      name: "A/B split · 50% · 30% · 20%",
    });
    expect(within(card).getByText("Path 1 · 50%")).toBeInTheDocument();
    expect(within(card).getByText("Path 2 · 30%")).toBeInTheDocument();
    expect(within(card).getByText("Path 3 · 20%")).toBeInTheDocument();
    expect(
      within(card).getByText(/converted best: 15% vs 10% for Path 1 · 50%/)
    ).toBeInTheDocument();
  });

  it("offers 'Send everyone here' on the leader's row only, on a live journey", async () => {
    withJourney(
      { ...live, ...abDraft() },
      journeyReport({ paths: { a: pathExperiment() } })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    const card = await screen.findByRole("region", {
      name: "A/B split · 50% · 30% · 20%",
    });
    const leaderRow = within(card).getByText("Path 2 · 30%").closest("tr")!;
    expect(
      within(leaderRow).getByRole("button", { name: "Send everyone here" })
    ).toBeInTheDocument();
    expect(
      within(card).getAllByRole("button", { name: "Send everyone here" })
    ).toHaveLength(1);
  });

  it("saves the split at 100/0 on confirm, and notifies with the leader's label", async () => {
    // Two paths with a sure leader, so the dialog has no warning.
    const twoPaths = {
      ...pathExperiment(),
      groups: pathExperiment().groups.filter((g) => g.id !== "c"),
    };
    withJourney(
      { ...live, ...abDraft() },
      journeyReport({ paths: { a: twoPaths } })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    const card = await screen.findByRole("region", {
      name: "A/B split · 50% · 30% · 20%",
    });
    await userEvent.click(
      within(card).getByRole("button", { name: "Send everyone here" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Send everyone down Path 2 · 30%?",
    });
    expect(dialog).toHaveTextContent(
      "People who reach this split from now on all take Path 2 · 30%."
    );
    expect(dialog).toHaveTextContent(
      "People already past it stay where they are."
    );
    expect(dialog).toHaveTextContent(
      "You can change the percentages back in the editor."
    );
    expect(dialog).not.toHaveTextContent(
      "There aren't enough people yet for a clear answer."
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send everyone" })
    );
    await waitFor(() => expect(PATCH).toHaveBeenCalled());
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/journeys/live-1",
      expect.objectContaining({
        lock_version: live.lock_version,
        steps: expect.objectContaining({
          a: expect.objectContaining({
            paths: [
              { percent: 0, next: "b" },
              { percent: 100, next: "b" },
              { percent: 0, next: "b" },
            ],
          }),
        }),
      }),
      expect.anything()
    );
    const body = vi.mocked(PATCH).mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["lock_version", "name", "steps"]);
    expect(showSuccessNotification).toHaveBeenCalledWith(
      "Everyone now goes down Path 2 · 100%."
    );
  });

  it("offers the button to a member too", async () => {
    withJourney(
      { ...live, ...abDraft() },
      journeyReport({ paths: { a: pathExperiment() } })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    const card = await screen.findByRole("region", {
      name: "A/B split · 50% · 30% · 20%",
    });
    expect(
      within(card).getByRole("button", { name: "Send everyone here" })
    ).toBeInTheDocument();
  });

  it("shows a muted line instead of the button once the split is already on one path", async () => {
    const full: PercentSplitStep = {
      id: "a",
      type: "split",
      mode: "percent",
      paths: [
        { percent: 0, next: "b" },
        { percent: 100, next: "b" },
        { percent: 0, next: "b" },
      ],
    };
    const base = abDraft();
    withJourney(
      { ...live, ...base, steps: { ...base.steps, a: full } },
      journeyReport({ paths: { a: pathExperiment() } })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    const card = await screen.findByRole("region", {
      name: "A/B split · 0% · 100% · 0%",
    });
    expect(
      within(card).queryByRole("button", { name: "Send everyone here" })
    ).not.toBeInTheDocument();
    expect(
      within(card).getByText("Everyone now goes down Path 2 · 100%.")
    ).toBeInTheDocument();
  });

  it("shows the muted line to a member too", async () => {
    const full: PercentSplitStep = {
      id: "a",
      type: "split",
      mode: "percent",
      paths: [
        { percent: 0, next: "b" },
        { percent: 100, next: "b" },
        { percent: 0, next: "b" },
      ],
    };
    const base = abDraft();
    withJourney(
      { ...live, ...base, steps: { ...base.steps, a: full } },
      journeyReport({ paths: { a: pathExperiment() } })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    const card = await screen.findByRole("region", {
      name: "A/B split · 0% · 100% · 0%",
    });
    expect(
      within(card).queryByRole("button", { name: "Send everyone here" })
    ).not.toBeInTheDocument();
    expect(
      within(card).getByText("Everyone now goes down Path 2 · 100%.")
    ).toBeInTheDocument();
  });

  it("warns in the dialog when the leader's confidence is too low", async () => {
    const base = pathExperiment();
    const lowConfidence = pathExperiment({
      groups: [
        base.groups[0]!,
        { ...base.groups[1]!, confidence: 0.5 },
        base.groups[2]!,
      ],
    });
    withJourney(
      { ...live, ...abDraft() },
      journeyReport({ paths: { a: lowConfidence } })
    );
    wrap(<JourneyReportPage journeyId="live-1" />);
    const card = await screen.findByRole("region", {
      name: "A/B split · 50% · 30% · 20%",
    });
    await userEvent.click(
      within(card).getByRole("button", { name: "Send everyone here" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Send everyone down Path 2 · 30%?",
    });
    expect(dialog).toHaveTextContent(
      "There aren't enough people yet for a clear answer."
    );
  });

  it("shows no A/B split card when the report has no path results", async () => {
    withJourney({ ...live, ...abDraft() }, journeyReport({ paths: {} }));
    wrap(<JourneyReportPage journeyId="live-1" />);
    await screen.findByText(
      `Launched ${LAUNCHED} · revision 1 · started on add_to_cart`
    );
    expect(screen.queryByText(/A\/B split/)).not.toBeInTheDocument();
  });

  it("shows no A/B split card when an older backend omits paths entirely", async () => {
    const report = journeyReport();
    expect("paths" in report).toBe(false);
    withJourney({ ...live, ...abDraft() }, report);
    wrap(<JourneyReportPage journeyId="live-1" />);
    await screen.findByText(
      `Launched ${LAUNCHED} · revision 1 · started on add_to_cart`
    );
    expect(screen.queryByText(/A\/B split/)).not.toBeInTheDocument();
  });

  it("says None for the control group when there is none", async () => {
    withJourney({ ...draft, control_group: null });
    vi.mocked(GET).mockImplementation((async (path: string) => {
      if (path.includes("/segments"))
        return ok({ segments: [], truncated: false });
      if (path.includes("/in_app_settings"))
        return ok({
          in_app_settings: {
            enabled: true,
            session_cap: 1,
            day_cap: 1,
            control_group: 0,
          },
        });
      return ok({ journey: { ...draft, control_group: null } });
    }) as never);
    wrap(<JourneyReportPage journeyId="draft-1" />);
    expect(await screen.findByText("None")).toBeInTheDocument();
    expect(screen.queryByText(/In the journey 100%/)).not.toBeInTheDocument();
  });

  it("words the banner for each state", () => {
    const ended = {
      ...live,
      status: "ended" as const,
      ended_at: "2026-09-29T10:00:00Z",
    };
    expect(bannerText(ended, journeyReport())).toBe(
      "Ended 29 Sep 2026: nobody new enters; 1,204 people are finishing."
    );
    // Without the report there is no count to show, never a zero.
    expect(bannerText(ended)).toBe("Ended 29 Sep 2026: nobody new enters.");
    expect(bannerText({ ...live, status: "paused" })).toBe(
      "Paused: nobody moves or enters until you resume."
    );
    expect(bannerText(live)).toBe("Live: people enter and move through it.");
    expect(goalVerdict({ ...journeyReport().goal!, confidence: 0.8 })).toBe(
      "not enough people yet for a clear answer"
    );
    expect(goalVerdict(null)).toBeNull();
  });
});

describe("goalText", () => {
  it("names the measured goal and lists the others as plain text", () => {
    expect(goalText([{ event: "checkout", window_hours: 168 }])).toBe(
      "Goal: checkout"
    );
    expect(
      goalText([
        { event: "checkout", window_hours: 168 },
        { screen: "Thanks", window_hours: 168 },
        { event: "subscribe", window_hours: 168 },
      ])
    ).toBe("Goal: checkout · also counts: Thanks, subscribe");
  });
});
