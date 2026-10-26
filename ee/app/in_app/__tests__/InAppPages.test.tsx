import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GET, POST } from "@/lib/api";
import {
  ok,
  polyfillDom,
  wrap,
} from "@ee/components/push/composer/__tests__/helpers";
import {
  choiceAnswers,
  experimentCampaign,
  inAppCampaign,
  inAppExperiment,
  inAppReport,
  questionCampaign,
  starsAnswers,
} from "@ee/lib/__tests__/inAppFixtures";
import InAppCampaignDialog from "@ee/components/in_app/InAppCampaignDialog";
import InAppCampaignsTable from "@ee/components/in_app/InAppCampaignsTable";
import type { InAppCampaign, InAppReport } from "@ee/types/inApp";
import type { Experiment } from "@ee/types/experiment";
import InAppCampaignsPage from "../InAppCampaignsPage";
import InAppReportPage, { answerRate } from "../InAppReportPage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/in_app",
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
vi.mock("@ee/hooks/queries/useInAppSuggestions", () => ({
  useInAppSuggestions: () => ({
    loading: false,
    userAttributes: [],
    eventProperties: [],
  }),
}));
vi.mock("@ee/components/in_app/InAppTrendChart", () => ({
  default: ({ clicks = true }: { clicks?: boolean }) => (
    <div data-testid="trend" data-clicks={String(clicks)} />
  ),
}));

const launched = {
  status: "live" as const,
  launched_at: "2026-09-20T10:00:00.000Z",
};
const plain = inAppCampaign({ id: "plain-1", ...launched });
const asked = questionCampaign(launched);

// Answers that are held back until a test lets them go.
let held: Record<string, () => void>;
let campaigns: InAppCampaign[];
let configurations: unknown[];
let report: InAppReport;
let experiment: Experiment;
let hold: string[];

const wait = (key: string) =>
  hold.some((part) => key.includes(part))
    ? new Promise<void>((resolve) => {
        held[key] = resolve;
      })
    : Promise.resolve();
const release = (part: string) =>
  Object.entries(held)
    .filter(([key]) => key.includes(part))
    .forEach(([, go]) => go());

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
  held = {};
  hold = [];
  campaigns = [plain, asked];
  configurations = [{ platform: "web", configuration: { domains: ["a.io"] } }];
  report = inAppReport(starsAnswers);
  experiment = inAppExperiment();
  vi.mocked(GET).mockImplementation((async (path: string) => {
    await wait(path);
    if (path.endsWith("/configurations")) return ok({ configurations });
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
    if (path.includes("/report")) return ok({ report });
    if (path.includes("/experiment")) return ok({ experiment });
    if (path.includes("/comments"))
      return ok({ comments: [], next_before: null });
    const one = campaigns.find((c) =>
      path.endsWith(`/in_app_campaigns/${c.id}`)
    );
    if (one) return ok({ in_app_campaign: one });
    return ok({
      in_app_campaigns: campaigns,
      truncated: false,
      next_after: null,
    });
  }) as never);
});

const busy = (name: string) => screen.queryByLabelText(name);
const stat = (label: string) =>
  screen.getByText(label, { selector: "p" }).parentElement!;
const heading = (name: string) => screen.findByRole("heading", { name });

describe("the report of an in-app message", () => {
  it("holds the shape of the page while the campaign loads", async () => {
    hold = ["/in_app_campaigns/plain-1"];
    wrap(<InAppReportPage campaignId="plain-1" />);
    const loading = await screen.findByLabelText("Loading in-app message");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(
      loading.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(20);
    release("/in_app_campaigns/plain-1");
    expect(await heading("Autumn sale")).toBeInTheDocument();
    expect(busy("Loading in-app message")).toBeNull();
  });

  it("a message with buttons counts clicks, as before", async () => {
    report = inAppReport(null);
    wrap(<InAppReportPage campaignId="plain-1" />);
    expect(await screen.findByText("Click rate")).toBeInTheDocument();
    expect(stat("Clicks")).toHaveTextContent("Clicks00 devices");
    expect(
      screen.getByRole("region", { name: "Clicks by button" })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "By platform" }))
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual(["Platform", "Views", "Clicks", "Dismissals"]);
    expect(screen.getByTestId("trend")).toHaveAttribute("data-clicks", "true");
    expect(screen.queryByText("Answer rate")).toBeNull();
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Results" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Answers" })).toBeNull();
  });

  it("a custom HTML message has no buttons to count clicks by", async () => {
    report = inAppReport(null);
    report.buttons = [{ button_id: null, clicks: 3 }];
    campaigns = [
      inAppCampaign({
        id: "html-1",
        ...launched,
        template: "html",
        content: { html: "<p>Hi</p>", layout: "modal" },
      }),
    ];
    wrap(<InAppReportPage campaignId="html-1" />);
    expect(await screen.findByText("Each button")).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Clicks by button" });
    expect(
      within(card)
        .getAllByRole("cell")
        .map((td) => td.textContent)
    ).toEqual(["Each button", "—"]);
  });

  it("a message that asks a question counts answers where clicks would be", async () => {
    wrap(<InAppReportPage campaignId="ask-1" />);
    expect(await screen.findByText("Answer rate")).toBeInTheDocument();
    expect(stat("Answers")).toHaveTextContent("Answers6");
    expect(stat("Answer rate")).toHaveTextContent("15.0%");
    expect(stat("Views")).toHaveTextContent("Views4038 devices");
    expect(stat("Dismissals")).toHaveTextContent("12");
    expect(screen.getAllByText("Answers", { selector: "p" })).toHaveLength(1);
    expect(screen.queryByText("Clicks", { selector: "p" })).toBeNull();
    expect(screen.queryByText("Click rate")).toBeNull();
    expect(screen.queryByText("Clicks by button")).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "By platform" }))
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual(["Platform", "Views", "Dismissals"]);
    expect(screen.getByTestId("trend")).toHaveAttribute("data-clicks", "false");
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    for (const name of ["Answers", "Results"])
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "What people answered" })
    ).toHaveTextContent("4.2 out of 5 on average");
  });

  it("five cards fill their rows: three, then two", async () => {
    wrap(<InAppReportPage campaignId="ask-1" />);
    await screen.findByText("Answer rate");
    const cards = [...stat("Views").parentElement!.children];
    expect(cards).toHaveLength(5);
    expect(cards.map((c) => c.className.match(/md:col-span-\d/)?.[0])).toEqual([
      "md:col-span-2",
      "md:col-span-2",
      "md:col-span-2",
      "md:col-span-3",
      "md:col-span-3",
    ]);
    expect(stat("Views").parentElement).toHaveClass("md:grid-cols-6");
  });

  it("the answer rate is the share of views that were answered", () => {
    expect(answerRate(474, 3120)).toBe("15.2%");
    expect(answerRate(0, 40)).toBe("0.0%");
    expect(answerRate(0, 0)).toBe("0%");
    expect(answerRate(3, 0)).toBe("0%");
  });

  it("while the results load, only they are held back", async () => {
    hold = ["/report"];
    wrap(<InAppReportPage campaignId="ask-1" />);
    expect(await heading("Rate the app")).toBeInTheDocument();
    const loading = screen.getByLabelText("Loading results");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(busy("Loading in-app message")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Period" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent(
      "Enjoying the app?"
    );
    // Five stars, five bars; four comments.
    const lists = loading.querySelectorAll("ul");
    expect(lists[0]!.children).toHaveLength(5);
    expect(lists[1]!.children).toHaveLength(4);
    release("/report");
    expect(await screen.findByText("Answer rate")).toBeInTheDocument();
    expect(busy("Loading results")).toBeNull();
    expect(screen.getAllByTestId("in-app-answer-bar")).toHaveLength(5);
  });

  it("a list of choices waits with a bar for each choice", async () => {
    hold = ["/report"];
    report = inAppReport(choiceAnswers);
    campaigns = [
      questionCampaign({
        ...launched,
        content: {
          title: "Which one?",
          question: {
            id: "q1",
            type: "choice",
            options: [
              { id: "a", text: "A" },
              { id: "b", text: "B" },
              { id: "c", text: "C" },
            ],
            comment: null,
            thanks: null,
            review_from: null,
          },
        },
      }),
    ];
    wrap(<InAppReportPage campaignId="ask-1" />);
    const loading = await screen.findByLabelText("Loading results");
    expect(loading.querySelector("ul")!.children).toHaveLength(3);
  });

  it("a journey's message is read-only here: it is changed in its journey", async () => {
    const step = inAppCampaign({
      id: "step-1",
      ...launched,
      audience: {
        type: "journey",
        segment_id: null,
        segment_definition_hash: null,
        segment_changed: true,
      },
    });
    campaigns = [step];
    wrap(<InAppReportPage campaignId="step-1" />);
    expect(
      await screen.findByText(/This message is a step of a journey/)
    ).toBeInTheDocument();
    for (const name of [
      "Edit",
      "Duplicate",
      "Pause",
      "Resume",
      "End",
      "Update audience",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByText(/The segment was edited/)).toBeNull();
  });

  it("a member can edit, pause, end and update the audience of a live campaign", async () => {
    campaigns = [
      inAppCampaign({
        id: "plain-1",
        ...launched,
        audience: {
          type: "all",
          segment_id: null,
          segment_definition_hash: null,
          segment_changed: true,
        },
      }),
    ];
    vi.mocked(POST).mockResolvedValue(
      ok({ in_app_campaign: campaigns[0] }) as never
    );
    wrap(<InAppReportPage campaignId="plain-1" />);
    await heading("Autumn sale");
    expect(screen.getByRole("button", { name: "End" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update audience" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith(
        expect.stringContaining("/in_app_campaigns/plain-1/pause"),
        {},
        expect.anything()
      )
    );
  });

  it("a campaign with an experiment shows its card under the numbers", async () => {
    report = inAppReport(null);
    campaigns = [plain, experimentCampaign()];
    wrap(<InAppReportPage campaignId="exp-1" />);
    expect(
      await screen.findByText("Project control group")
    ).toBeInTheDocument();
    const results = stat("Views").parentElement!.parentElement!;
    const order = [...results.children].map(
      (c) => c.querySelector("h3")?.textContent ?? "tiles"
    );
    expect(order.slice(0, 4)).toEqual([
      "Results",
      "tiles",
      "Experiment",
      "Over time",
    ]);
    expect(screen.getByText("checkout within 3 days")).toBeInTheDocument();
  });

  it("a banner says where the experiment stands, and rolls the winner out", async () => {
    report = inAppReport(null);
    campaigns = [experimentCampaign()];
    wrap(<InAppReportPage campaignId="exp-1" />);
    const banner = await screen.findByText(
      "B does better than A: 6.5% vs 5.7% conversion rate (96% confidence) · variants beat the control by 83%."
    );
    expect(banner.closest("[role=status]")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Use B for everyone" })
    );
    expect(
      await screen.findByRole("dialog", { name: "Use variant B for everyone?" })
    ).toBeInTheDocument();
  });

  it("the banner says the experiment is still running, or the control's verdict, and ends quietly", async () => {
    report = inAppReport(null);
    experiment = inAppExperiment({
      more_people_needed: 1900,
      groups: inAppExperiment().groups.map((g) =>
        g.id === "b" ? { ...g, confidence: 0.7 } : g
      ),
    });
    campaigns = [experimentCampaign()];
    const running = wrap(<InAppReportPage campaignId="exp-1" />);
    expect(
      await screen.findByText(
        "Experiment running since 20 Sep 2026 · 4,120 saw A, 4,098 saw B · not enough people yet for a clear answer."
      )
    ).toBeInTheDocument();
    // The card's per-row buttons stay; the banner offers none.
    expect(
      screen.queryByRole("button", { name: "Use B for everyone" })
    ).toBeNull();
    running.unmount();

    experiment = inAppExperiment({
      groups: inAppExperiment().groups.filter((g) => g.id !== "b"),
    });
    campaigns = [experimentCampaign({ variants: null })];
    const control = wrap(<InAppReportPage campaignId="exp-1" />);
    expect(
      (
        await screen.findAllByText(
          "Variants convert 83% better than the control: about +47 conversions (99% confidence)."
        )
      ).length
    ).toBeGreaterThan(0);
    control.unmount();

    experiment = inAppExperiment();
    campaigns = [
      experimentCampaign({ status: "ended", ended_at: "2026-09-25T10:00:00Z" }),
    ];
    wrap(<InAppReportPage campaignId="exp-1" />);
    expect(
      await screen.findByText(/^B does better than A/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use B for everyone" })
    ).toBeNull();
  });

  it("the Message panel previews the chosen variant over A's content", async () => {
    report = inAppReport(null);
    campaigns = [
      experimentCampaign({
        content: {
          title: "Hello",
          message: "Welcome",
          image: { portrait: "https://cdn.example/a.png", landscape: null },
        },
        variants: [{ id: "b", content: { title: "Hi", message: "Sale on" } }],
      }),
    ];
    wrap(<InAppReportPage campaignId="exp-1" />);
    const preview = await screen.findByTestId("in-app-preview-card");
    expect(preview).toHaveTextContent("Hello");
    const aside = screen.getByRole("complementary");
    await userEvent.click(within(aside).getByRole("radio", { name: "B" }));
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent("Hi");
    expect(screen.getByTestId("in-app-preview-card")).toHaveTextContent(
      "Sale on"
    );
    // Pictures are A's.
    expect(
      screen.getByTestId("in-app-preview-card").querySelector("img")
    ).toHaveAttribute("src", "https://cdn.example/a.png");
    await userEvent.click(
      screen.getByRole("button", { name: "Open a larger preview" })
    );
    const large = await screen.findByRole("dialog", { name: "Preview" });
    expect(within(large).getByTestId("in-app-preview-card")).toHaveTextContent(
      "Hi"
    );
  });

  it("without an experiment or a project control group, nothing is asked", async () => {
    report = inAppReport(null);
    wrap(<InAppReportPage campaignId="plain-1" />);
    await screen.findByText("Click rate");
    expect(screen.queryByRole("region", { name: "Experiment" })).toBeNull();
    expect(
      vi.mocked(GET).mock.calls.some(([path]) => path.includes("/experiment"))
    ).toBe(false);
  });

  it("another period keeps the header and the message where they are", async () => {
    wrap(<InAppReportPage campaignId="ask-1" />);
    await screen.findByText("Answer rate");
    const title = screen.getByRole("heading", { name: "Rate the app" });
    const preview = screen.getByTestId("in-app-preview-card");
    const period = screen.getByRole("combobox", { name: "Period" });
    hold = ["/report"];
    await userEvent.click(period);
    await userEvent.click(screen.getByRole("option", { name: "Last 7 days" }));
    expect(await screen.findByLabelText("Loading results")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rate the app" })).toBe(title);
    expect(screen.getByTestId("in-app-preview-card")).toBe(preview);
    expect(screen.getByRole("combobox", { name: "Period" })).toBe(period);
    expect(period).toHaveTextContent("Last 7 days");
    expect(busy("Loading in-app message")).toBeNull();
    release("/report");
    expect(await screen.findByText("Answer rate")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rate the app" })).toBe(title);
  });
});

describe("the list of in-app messages", () => {
  const table = () => screen.getByRole("table", { name: "In-app messages" });
  const skeletons = () => table().querySelectorAll('[data-slot="skeleton"]');

  it("holds rows with the columns of the table while it loads", async () => {
    hold = ["/in_app_campaigns"];
    wrap(<InAppCampaignsPage />);
    expect(within(table()).getAllByRole("row")).toHaveLength(6);
    expect(skeletons()).toHaveLength(5 * 7);
    expect(table().closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("combobox", { name: "Status" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /New message/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Open in-app/ })).toBeNull();
    release("/in_app_campaigns");
    expect(
      await screen.findByRole("button", {
        name: "Open in-app message Autumn sale",
      })
    ).toBeInTheDocument();
    expect(skeletons()).toHaveLength(0);
    expect(table().closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });
});

describe("setting up a platform for in-app messages", () => {
  it("replaces an empty list with the setup panel when no platform is connected", async () => {
    configurations = [];
    campaigns = [];
    wrap(<InAppCampaignsPage />);
    expect(
      await screen.findByRole("heading", {
        name: "Connect a platform to show in-app messages",
      })
    ).toBeInTheDocument();
    for (const [name, href] of [
      ["iOS", "/settings/developers/ios_setup"],
      ["Android", "/settings/developers/android_setup"],
      ["Web", "/settings/developers/web_setup"],
    ])
      expect(
        screen.getByRole("link", { name: `Set up ${name} in-app messages` })
      ).toHaveAttribute("href", href);
    expect(screen.queryByText("No in-app messages yet")).toBeNull();
    expect(screen.queryByRole("button", { name: /New message/ })).toBeNull();
  });

  it("holds the table skeleton while the platform check is pending", async () => {
    configurations = [];
    campaigns = [];
    hold = ["/configurations"];
    wrap(<InAppCampaignsPage />);
    const table = await screen.findByRole("table", { name: "In-app messages" });
    await waitFor(() =>
      expect(
        table.querySelectorAll('[data-slot="skeleton"]').length
      ).toBeGreaterThan(0)
    );
    expect(screen.queryByText("No in-app messages yet")).toBeNull();
    release("/configurations");
    expect(
      await screen.findByRole("heading", {
        name: "Connect a platform to show in-app messages",
      })
    ).toBeInTheDocument();
  });

  it("falls back to the normal empty state when the platform check fails", async () => {
    campaigns = [];
    const base = vi.mocked(GET).getMockImplementation()!;
    vi.mocked(GET).mockImplementation((async (
      path: string,
      ...rest: unknown[]
    ) => {
      if (path.endsWith("/configurations")) throw new Error("down");
      return base(path, ...(rest as []));
    }) as never);
    wrap(<InAppCampaignsPage />);
    expect(
      await screen.findByText("No in-app messages yet")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Connect a platform to show in-app messages",
      })
    ).toBeNull();
  });

  it("shows the normal empty state once one platform is connected", async () => {
    campaigns = [];
    wrap(<InAppCampaignsPage />);
    expect(
      await screen.findByText("No in-app messages yet")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Connect a platform to show in-app messages",
      })
    ).toBeNull();
  });
});

describe("the table of in-app messages", () => {
  it("holds three more rows under the ones it has while it loads more", () => {
    wrap(
      <InAppCampaignsTable
        campaigns={[plain, asked]}
        loading={false}
        hasFilters={false}
        hasMore
        loadingMore
        onLoadMore={vi.fn()}
        segmentNames={new Map()}
        actions={{
          onOpen: vi.fn(),
          onEdit: vi.fn(),
          onDuplicate: vi.fn(),
          onStep: vi.fn(),
          onDelete: vi.fn(),
        }}
        onCreate={vi.fn()}
      />
    );
    const table = screen.getByRole("table", { name: "In-app messages" });
    expect(
      within(table).getAllByRole("button", { name: /^Open in-app/ })
    ).toHaveLength(2);
    expect(table.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(21);
    expect(table.closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });
});

describe("the dialog of a campaign that is edited", () => {
  it("holds the shape of the composer while the campaign loads", async () => {
    hold = ["/in_app_campaigns/ask-1"];
    wrap(
      <InAppCampaignDialog
        open
        onOpenChange={vi.fn()}
        projectId="p1"
        campaignId="ask-1"
      />
    );
    const loading = await screen.findByLabelText("Loading in-app message");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading.children).toHaveLength(2);
    expect(
      loading.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(15);
    release("/in_app_campaigns/ask-1");
    expect(await screen.findByLabelText("Title")).toHaveValue(
      "Enjoying the app?"
    );
    await waitFor(() => expect(busy("Loading in-app message")).toBeNull());
  });
});
