import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SmartBannersPage from "@/app/(protected)/smart_banners/page";
import NewSmartBannerPage from "@/app/(protected)/smart_banners/new/page";
import EditSmartBannerPage from "@/app/(protected)/smart_banners/[bannerId]/page";
import type { SmartBanner, SmartBannersStatus } from "@/types";
import {
  NOT_SET_UP,
  READY,
  DOMAIN_ONLY,
  makeBanner,
  stubResizeObserver,
} from "./fixtures";

beforeAll(stubResizeObserver);

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));
// The URL's ?banner= param, seeded per test for deep links.
let initialParam = "";
vi.mock("@/hooks/useUrlState", () => ({
  useUrlState: () => useState(initialParam),
}));
const project = {
  selectedProject: { id: "p1" },
  selectedInstance: { api_key: "key-1", test: { id: "p1" } },
};
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => project,
}));
vi.mock("@/components/layout/app-header", () => ({ default: () => null }));
vi.mock("@/components/smart_banners/SmartBannerDialog", () => ({
  default: ({
    open,
    bannerId,
    onOpenChange,
  }: {
    open: boolean;
    bannerId: number | null;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Banner dialog">
        {bannerId === null ? "new" : `banner ${bannerId}`}
        <button onClick={() => onOpenChange(false)}>Close dialog</button>
      </div>
    ) : null,
}));
// Shiki highlighting is async and irrelevant here.
vi.mock("@/components/developers/SetupShared", () => ({
  RenderCodeBlock: ({ data }: { data: { code: string }[] }) => (
    <pre data-testid="snippet">{data[0]!.code}</pre>
  ),
}));
vi.mock("@/lib/Notifications", () => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));

const statusQuery = vi.fn();
const bannersQuery = vi.fn();
vi.mock("@/hooks/queries/useSmartBannersQueries", () => ({
  useSmartBannersStatusQuery: () => statusQuery(),
  useSmartBannersQuery: () => bannersQuery(),
}));
const update = { mutate: vi.fn(), isPending: false };
const remove = { mutateAsync: vi.fn(), isPending: false };
const reorder = { mutate: vi.fn(), isPending: false };
const duplicate = { mutate: vi.fn(), isPending: false };
vi.mock("@/hooks/mutations/useSmartBannersMutations", () => ({
  useUpdateSmartBannerMutation: () => update,
  useDeleteSmartBannerMutation: () => remove,
  useDuplicateSmartBannerMutation: () => duplicate,
  useReorderSmartBannersMutation: () => reorder,
}));

const refetch = vi.fn();
const statusResult = (
  data: SmartBannersStatus | undefined,
  over: Record<string, unknown> = {}
) => ({
  data,
  isError: false,
  isFetching: false,
  refetch,
  ...over,
});
const loaded = (data: unknown) => ({
  data,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

const dialog = () => screen.queryByRole("dialog", { name: "Banner dialog" });
const sentStatus = (call = 0) =>
  (update.mutate.mock.calls[call]![0].fd as FormData).get(
    "smart_banner[status]"
  );

beforeEach(() => {
  vi.clearAllMocks();
  initialParam = "";
  bannersQuery.mockReturnValue({
    data: undefined,
    isPending: true,
    isError: false,
    isFetching: true,
    refetch: vi.fn(),
  });
});

describe("SmartBannersPage setup gate", () => {
  it("asks to link a domain first, with the SDK snippet as the next step", async () => {
    statusQuery.mockReturnValue(statusResult(NOT_SET_UP));
    render(<SmartBannersPage />);
    expect(
      screen.getByRole("heading", {
        name: "Turn mobile web visitors into app users",
      })
    ).toBeInTheDocument();
    const steps = within(
      screen.getByRole("list", { name: "Setup steps" })
    ).getAllByRole("listitem");
    expect(steps.map((s) => s.dataset.state)).toEqual([
      "current",
      "next",
      "locked",
    ]);
    expect(
      screen.getByRole("link", { name: /Set up Web SDK/ })
    ).toHaveAttribute("href", "/settings/developers/web_setup");
    expect(screen.getByTestId("snippet")).toHaveTextContent(
      'apiKey: "key-1", testEnvironment: true'
    );
    expect(screen.queryByText(/Waiting for your website/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Check again" })).toBeNull();
    expect(screen.queryByRole("button", { name: /New banner/ })).toBeNull();
    expect(screen.getByTestId("smart-banner-preview")).toHaveTextContent(
      "Faster checkout in our app"
    );
    expect(screen.getByText("yourshop.com")).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: "Preview on" })).getByRole(
        "radio",
        { name: "Android" }
      )
    );
    expect(screen.getByTestId("smart-banner-phone")).toHaveAttribute(
      "data-platform",
      "android"
    );
  });

  it("opens the list as soon as a domain is linked, before the SDK is seen", () => {
    statusQuery.mockReturnValue(statusResult(DOMAIN_ONLY));
    bannersQuery.mockReturnValue(loaded([]));
    render(<SmartBannersPage />);
    expect(screen.queryByRole("list", { name: "Setup steps" })).toBeNull();
    expect(screen.getByText("No smart banners yet")).toBeInTheDocument();
    expect(screen.queryByTestId("sdk-connected")).toBeNull();
  });

  it("treats a seen SDK as integrated even without a configured domain", () => {
    statusQuery.mockReturnValue(
      statusResult({ ...NOT_SET_UP, sdk_last_seen_at: READY.sdk_last_seen_at })
    );
    bannersQuery.mockReturnValue(loaded([]));
    render(<SmartBannersPage />);
    expect(screen.queryByRole("list", { name: "Setup steps" })).toBeNull();
    expect(screen.getByText("No smart banners yet")).toBeInTheDocument();
  });

  it("shows the setup skeleton while the status loads", () => {
    statusQuery.mockReturnValue(statusResult(undefined));
    render(<SmartBannersPage />);
    expect(
      screen.getByTestId("smart-banner-setup-skeleton")
    ).toBeInTheDocument();
  });

  it("shows an inline message with retry when the status fails", async () => {
    statusQuery.mockReturnValue(statusResult(undefined, { isError: true }));
    render(<SmartBannersPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not check whether your website is connected."
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("SmartBannersPage list", () => {
  beforeEach(() => statusQuery.mockReturnValue(statusResult(READY)));

  it("shows the empty state inside the table when there are no banners", async () => {
    bannersQuery.mockReturnValue(loaded([]));
    render(<SmartBannersPage />);
    const empty = screen
      .getByText("No smart banners yet")
      .closest<HTMLElement>("[role=status]")!;
    await userEvent.click(
      within(empty).getByRole("button", { name: /Create your first banner/ })
    );
    expect(dialog()).toHaveTextContent("new");
    expect(screen.queryByText(/Web SDK connected/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Last 30 days" })).toBeNull();
  });

  it("shows the 30-day totals and the table without a connection line", () => {
    bannersQuery.mockReturnValue(
      loaded([
        makeBanner(1, "Products"),
        makeBanner(2, "Blog", {
          stats: {
            views: 300,
            clicks: 30,
            dismisses: 0,
            ctr: 0.1,
            opens: 0,
            installs: 3,
          },
        }),
      ])
    );
    render(<SmartBannersPage />);
    expect(screen.queryByText(/Web SDK connected/)).toBeNull();
    const summary = screen.getByRole("region", { name: "Last 30 days" });
    expect(summary).toHaveTextContent("CTR");
    expect(summary).toHaveTextContent("400");
    expect(summary).toHaveTextContent("40");
    expect(summary).toHaveTextContent("10.0%");
    expect(summary).toHaveTextContent("5");
    expect(screen.getAllByTestId("smart-banner-row")).toHaveLength(2);
    expect(
      screen.getByText(
        /When several banners match a page, the one with the highest priority is shown\./
      )
    ).toBeInTheDocument();
  });

  const bannerStats = (over: Partial<SmartBanner["stats"]>) => ({
    views: 0,
    clicks: 0,
    dismisses: 0,
    ctr: 0,
    opens: 0,
    installs: 0,
    ...over,
  });

  it("excludes archived banners from the default view's 30-day totals", () => {
    bannersQuery.mockReturnValue(
      loaded([
        makeBanner(1, "Products", {
          stats: bannerStats({ views: 100, clicks: 10, ctr: 0.1, installs: 1 }),
        }),
        makeBanner(2, "Old", {
          status: "archived",
          stats: bannerStats({ views: 900, clicks: 90, ctr: 0.1, installs: 9 }),
        }),
      ])
    );
    render(<SmartBannersPage />);
    const summary = screen.getByRole("region", { name: "Last 30 days" });
    expect(summary).toHaveTextContent("100");
    expect(summary).not.toHaveTextContent("900");
  });

  it("totals the archived banners instead, when viewing the Archived filter", async () => {
    bannersQuery.mockReturnValue(
      loaded([
        makeBanner(1, "Products", {
          stats: bannerStats({ views: 100, clicks: 10, ctr: 0.1, installs: 1 }),
        }),
        makeBanner(2, "Old", {
          status: "archived",
          stats: bannerStats({ views: 900, clicks: 90, ctr: 0.1, installs: 9 }),
        }),
      ])
    );
    render(<SmartBannersPage />);
    await userEvent.click(screen.getByRole("button", { name: "Status: All" }));
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Archived" })
    );
    const summary = screen.getByRole("region", { name: "Last 30 days" });
    expect(summary).toHaveTextContent("900");
    expect(summary).not.toHaveTextContent("100");
  });

  it("hints at the Archived view instead of the create-first-banner CTA when every banner is archived", async () => {
    bannersQuery.mockReturnValue(
      loaded([makeBanner(1, "Old", { status: "archived" })])
    );
    render(<SmartBannersPage />);
    expect(screen.queryByText("No smart banners yet")).toBeNull();
    const empty = screen
      .getByText("No active banners")
      .closest<HTMLElement>("[role=status]")!;
    expect(
      within(empty).getByText(/Every banner is archived/)
    ).toBeInTheDocument();
    await userEvent.click(
      within(empty).getByRole("button", { name: "View archived banners" })
    );
    expect(
      screen.getByRole("button", { name: "Status: Archived" })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("smart-banner-row")).toHaveLength(1);
  });

  it("opens the composer dialog from New banner and closes back to the list", async () => {
    bannersQuery.mockReturnValue(loaded([makeBanner(1, "Products")]));
    render(<SmartBannersPage />);
    expect(dialog()).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /New banner/ }));
    expect(dialog()).toHaveTextContent("new");
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(dialog()).toBeNull();
    expect(screen.getAllByTestId("smart-banner-row")).toHaveLength(1);
  });

  it("opens a banner in the dialog from its row or the Edit menu item", async () => {
    bannersQuery.mockReturnValue(
      loaded([makeBanner(1, "Products"), makeBanner(2, "Blog")])
    );
    render(<SmartBannersPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Open smart banner Products" })
    );
    expect(dialog()).toHaveTextContent("banner 1");
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Blog" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Edit" })
    );
    expect(dialog()).toHaveTextContent("banner 2");
  });

  it.each([
    ["new", "new"],
    ["7", "banner 7"],
  ])("opens the dialog from the ?banner=%s deep link", (param, shown) => {
    initialParam = param;
    bannersQuery.mockReturnValue(loaded([makeBanner(1, "Products")]));
    render(<SmartBannersPage />);
    expect(dialog()).toHaveTextContent(shown);
  });

  it("ignores a malformed deep link", () => {
    initialParam = "abc";
    bannersQuery.mockReturnValue(loaded([makeBanner(1, "Products")]));
    render(<SmartBannersPage />);
    expect(dialog()).toBeNull();
  });

  it("keeps the dialog closed behind the setup gate", () => {
    initialParam = "new";
    statusQuery.mockReturnValue(statusResult(NOT_SET_UP));
    render(<SmartBannersPage />);
    expect(dialog()).toBeNull();
    expect(
      screen.getByRole("list", { name: "Setup steps" })
    ).toBeInTheDocument();
  });

  it("moves a banner to the top or bottom through the reorder mutation", async () => {
    bannersQuery.mockReturnValue(
      loaded([
        makeBanner(1, "Products"),
        makeBanner(2, "Blog"),
        makeBanner(3, "Sale"),
        makeBanner(4, "Old", { status: "archived" }),
      ])
    );
    render(<SmartBannersPage />);
    expect(
      screen.getAllByTestId("smart-banner-priority").map((p) => p.textContent)
    ).toEqual(["1", "2", "3"]);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Sale" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Move to top" })
    );
    expect(reorder.mutate.mock.calls[0]![0]).toEqual([3, 1, 2]);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Products" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Move to bottom" })
    );
    expect(reorder.mutate.mock.calls[1]![0]).toEqual([2, 3, 1]);
  });

  it("disables drag while the list refetches, even if no reorder is pending", () => {
    bannersQuery.mockReturnValue({
      data: [makeBanner(1, "Products"), makeBanner(2, "Blog")],
      isPending: false,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    });
    render(<SmartBannersPage />);
    expect(
      screen.getByRole("button", { name: "Reorder Products" })
    ).toBeDisabled();
  });

  it("pauses, archives and deletes from the row menu", async () => {
    bannersQuery.mockReturnValue(
      loaded([
        makeBanner(1, "Products"),
        makeBanner(2, "Blog", { status: "paused" }),
      ])
    );
    remove.mutateAsync.mockResolvedValue(2);
    render(<SmartBannersPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Products" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Pause" })
    );
    expect(update.mutate.mock.calls[0]![0].id).toBe(1);
    expect(sentStatus(0)).toBe("paused");
    expect([
      ...(update.mutate.mock.calls[0]![0].fd as FormData).keys(),
    ]).toEqual(["smart_banner[status]"]);

    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Products" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Archive" })
    );
    expect(screen.getByText("Archive Products?")).toBeInTheDocument();
    expect(update.mutate).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(update.mutate).toHaveBeenCalledTimes(2));
    expect(sentStatus(1)).toBe("archived");

    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Blog" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Delete" })
    );
    expect(screen.getByText("Delete Blog?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove.mutateAsync).toHaveBeenCalledWith(2);
    expect(dialog()).toBeNull();
  });

  it("publishes a draft and restores an archived banner as paused", async () => {
    bannersQuery.mockReturnValue(
      loaded([
        makeBanner(1, "Products", { status: "draft" }),
        makeBanner(4, "Old", { status: "archived" }),
      ])
    );
    render(<SmartBannersPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Status of Products: Draft" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Publish" })
    );
    expect(sentStatus(0)).toBe("live");
    await userEvent.click(screen.getByRole("button", { name: "Status: All" }));
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Archived" })
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Old" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Restore" })
    );
    expect(update.mutate.mock.calls[1]![0].id).toBe(4);
    expect(sentStatus(1)).toBe("paused");
  });

  it("duplicates a banner and opens the copy", async () => {
    bannersQuery.mockReturnValue(loaded([makeBanner(1, "Products")]));
    duplicate.mutate.mockImplementation(
      (_id: number, o: { onSuccess: (b: unknown) => void }) =>
        o.onSuccess(makeBanner(9, "Products copy", { status: "draft" }))
    );
    render(<SmartBannersPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Products" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Duplicate" })
    );
    expect(duplicate.mutate.mock.calls[0]![0]).toBe(1);
    expect(dialog()).toHaveTextContent("banner 9");
  });

  it("shows skeletons while banners load", () => {
    render(<SmartBannersPage />);
    expect(
      screen
        .getByRole("table", { name: "Smart banners" })
        .closest("[aria-busy]")
    ).toHaveAttribute("aria-busy", "true");
  });
});

describe("SmartBannersPage search and filters", () => {
  beforeEach(() => {
    statusQuery.mockReturnValue(statusResult(READY));
    bannersQuery.mockReturnValue(
      loaded([
        makeBanner(1, "Products", {
          title: "Shop in the app",
          platforms: ["ios"],
        }),
        makeBanner(2, "Blog", { status: "paused", platforms: ["android"] }),
        makeBanner(3, "Sale", { default_link: null }),
        makeBanner(4, "Old", { status: "archived" }),
        makeBanner(5, "Next", { status: "draft" }),
      ])
    );
  });
  const names = () =>
    screen.queryAllByTestId("smart-banner-row").map((r) => r.dataset.name);

  it("filters rows by name or title as you type", async () => {
    render(<SmartBannersPage />);
    expect(
      screen.getByRole("button", { name: "Reorder Products" })
    ).toBeEnabled();
    await userEvent.type(screen.getByPlaceholderText("Search banner"), "shop");
    expect(names()).toEqual(["Products"]);
    expect(
      screen.getByRole("button", { name: "Reorder Products" })
    ).toBeDisabled();
    expect(
      screen.getByText(/Clear the search and filters to reorder\./)
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Products" })
    );
    expect(
      await screen.findByRole("menuitem", { name: "Move to top" })
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
    await userEvent.clear(screen.getByPlaceholderText("Search banner"));
    expect(names()).toEqual(["Products", "Blog", "Sale", "Next"]);
    expect(
      screen.getByRole("button", { name: "Reorder Products" })
    ).toBeEnabled();
  });

  it("filters by status and platform", async () => {
    render(<SmartBannersPage />);
    await userEvent.click(screen.getByRole("button", { name: "Status: All" }));
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Paused" })
    );
    expect(names()).toEqual(["Blog"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "All" }));
    expect(names()).toEqual(["Products", "Blog", "Sale", "Next"]);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("checkbox", { name: "iOS" }));
    expect(names()).toEqual(["Products", "Sale", "Next"]);
    expect(screen.getByRole("button", { name: "Reorder Sale" })).toBeDisabled();
  });

  it("shows drafts and archived banners in their own views, archived without priority", async () => {
    render(<SmartBannersPage />);
    expect(
      screen.getByRole("columnheader", { name: "Priority" })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Status: All" }));
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Drafts" })
    );
    expect(names()).toEqual(["Next"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Archived" }));
    expect(names()).toEqual(["Old"]);
    expect(screen.queryByRole("columnheader", { name: "Priority" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reorder/ })).toBeNull();
    expect(screen.queryByText(/highest priority/)).toBeNull();
  });

  it("shows no results, not the empty state, when nothing matches", async () => {
    render(<SmartBannersPage />);
    await userEvent.type(screen.getByPlaceholderText("Search banner"), "zzz");
    expect(names()).toEqual([]);
    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(screen.queryByText("No smart banners yet")).toBeNull();
  });
});

describe("deep links", () => {
  it("sends /new to the list with the composer open", async () => {
    await NewSmartBannerPage({});
    expect(redirect).toHaveBeenCalledWith("/smart_banners?banner=new");
  });

  it("sends /[id] to the list with that banner open, or just the list", async () => {
    await EditSmartBannerPage({ params: Promise.resolve({ bannerId: "5" }) });
    expect(redirect).toHaveBeenLastCalledWith("/smart_banners?banner=5");
    await EditSmartBannerPage({ params: Promise.resolve({ bannerId: "abc" }) });
    expect(redirect).toHaveBeenLastCalledWith("/smart_banners");
  });

  it("keeps the project and environment through the redirect", async () => {
    const searchParams = Promise.resolve({
      instance_id: "9",
      env_type: "test",
    });
    await NewSmartBannerPage({ searchParams });
    expect(redirect).toHaveBeenLastCalledWith(
      "/smart_banners?instance_id=9&env_type=test&banner=new"
    );
    await EditSmartBannerPage({
      params: Promise.resolve({ bannerId: "5" }),
      searchParams: Promise.resolve({ instance_id: "9", banner: "stale" }),
    });
    expect(redirect).toHaveBeenLastCalledWith(
      "/smart_banners?instance_id=9&banner=5"
    );
    await EditSmartBannerPage({
      params: Promise.resolve({ bannerId: "abc" }),
      searchParams,
    });
    expect(redirect).toHaveBeenLastCalledWith(
      "/smart_banners?instance_id=9&env_type=test"
    );
  });
});
