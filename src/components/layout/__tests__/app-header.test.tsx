import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Covers the breadcrumb's root-segment linking rule (`linkableRoots` in app-header.tsx):
// a root whose child routes are hashids (segments, push) stays a link even though the
// numeric-id rule that links other roots' child pages doesn't fire for a hashid.
const state = { pathname: "/push/aB3xZ9", query: "" };

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(state.query),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/lib/edition", () => ({
  IS_SELF_HOSTED: false,
  IS_ENTERPRISE: true,
}));

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    projectType: "Production",
    setProjectType: vi.fn(),
    selectedInstance: { id: "i1" },
  }),
}));

vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: () => ({
    data: { subscription: null, isEnterprise: false },
    isLoading: false,
    isFetched: true,
  }),
  useMauQuery: () => ({ data: { current_quantity: 0, total_available: 1 } }),
}));

vi.mock("@/lib/integrations", () => ({ CHATWOOT_ENABLED: true }));
vi.mock("@/context/useChatwoot", () => ({
  useChatwoot: () => ({ toggleChat: vi.fn() }),
}));

import AppHeader from "@/components/layout/app-header";
import { SidebarProvider } from "@/components/ui/sidebar";

const renderHeader = (titleOverride?: string, hideEnvSelect?: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SidebarProvider>
        <AppHeader
          titleOverride={titleOverride}
          hideEnvSelect={hideEnvSelect}
        />
      </SidebarProvider>
    </QueryClientProvider>
  );

describe("AppHeader breadcrumb", () => {
  beforeEach(() => {
    state.pathname = "/push/aB3xZ9";
    state.query = "";
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });

  it("links the Push root crumb to /push on a campaign report page", () => {
    renderHeader();
    const crumb = screen.getByLabelText("breadcrumb");
    const link = crumb.querySelector('a[href^="/push"]');
    expect(link?.getAttribute("href")).toMatch(/^\/push\/?(\?|$)/);
    expect(link?.textContent).toMatch(/push/i);
  });

  it("shows Details as the last crumb on a campaign report", () => {
    renderHeader("Details");
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.queryByText("aB3xZ9")).not.toBeInTheDocument();
  });

  it("still links the Segments root crumb (existing behavior unaffected)", () => {
    state.pathname = "/segments/seg-1";
    renderHeader("Active iOS buyers");
    const crumb = screen.getByLabelText("breadcrumb");
    const link = crumb.querySelector('a[href^="/segments"]');
    expect(link?.getAttribute("href")).toMatch(/^\/segments\/?(\?|$)/);
    expect(screen.getByText("Active iOS buyers")).toBeInTheDocument();
  });

  it("carries only the project and environment onto crumb links", () => {
    state.query = "instance_id=9&env_type=Test&status=draft&page=3";
    renderHeader("Details");
    const link = screen
      .getByLabelText("breadcrumb")
      .querySelector('a[href^="/push"]');
    expect(link?.getAttribute("href")).toBe(
      "/push?instance_id=9&env_type=Test"
    );
  });

  it.each([
    "/settings/usage",
    "/settings/team",
    "/settings/developers/access_key",
  ])("shows the chat button on %s, which hides the env switcher", (path) => {
    state.pathname = path;
    renderHeader(undefined, true);
    expect(
      screen.getByRole("button", { name: "Live chat" })
    ).toBeInTheDocument();
  });

  it("shows the chat button next to the env switcher", () => {
    renderHeader();
    expect(
      screen.getByRole("button", { name: "Live chat" })
    ).toBeInTheDocument();
  });
});
