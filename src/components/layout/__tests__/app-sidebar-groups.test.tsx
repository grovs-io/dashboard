import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const routeState = { pathname: "/dashboard", query: "" };
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => routeState.pathname,
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(routeState.query),
}));

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedInstance: { id: "i1" } }),
}));

vi.mock("@ee/hooks/queries/useAuditQueries", () => ({
  useAuditLogAccess: () => ({ allowed: false, isResolving: false }),
}));

vi.mock("@/components/layout/team-switcher", () => ({
  ProjectSwitcher: () => <div>switcher</div>,
}));
vi.mock("@/components/layout/SetupSidebarEntry", () => ({
  SetupSidebarEntry: () => null,
}));
vi.mock("@/lib/integrations", () => ({ CHATWOOT_ENABLED: true }));
vi.mock("@/context/useChatwoot", () => ({
  useChatwoot: () => ({ toggleChat: vi.fn() }),
}));
vi.mock("@/components/layout/nav-user", () => ({
  NavUser: () => <div>user</div>,
}));

// Sections are built at module load from IS_ENTERPRISE, so re-import per edition.
const renderSidebar = async (enterprise = true, sidebarOpen = true) => {
  vi.resetModules();
  vi.doMock("@/lib/edition", () => ({
    IS_ENTERPRISE: enterprise,
    IS_SELF_HOSTED: false,
  }));
  const { AppSidebar } = await import("@/components/layout/app-sidebar");
  const { SidebarProvider } = await import("@/components/ui/sidebar");
  return render(
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar />
    </SidebarProvider>
  );
};

const group = (title: string) => screen.getByText(title).closest("button")!;
const link = (title: string) => screen.getByText(title).closest("a")!;

describe("AppSidebar groups", () => {
  beforeEach(() => {
    routeState.pathname = "/dashboard";
    routeState.query = "";
    push.mockClear();
    localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });

  it("shows Home and every group closed by default", async () => {
    await renderSidebar();
    expect(link("Home")).toHaveAttribute("href", "/dashboard");
    for (const title of [
      "Analytics",
      "Links",
      "Audience",
      "Engage",
      "Developers",
      "Settings",
    ]) {
      expect(group(title)).toHaveAttribute("data-state", "closed");
    }
    expect(screen.queryByText("Dynamic Links")).not.toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });

  it("opens a group on click, showing its pages", async () => {
    await renderSidebar();
    fireEvent.click(group("Links"));
    expect(group("Links")).toHaveAttribute("data-state", "open");
    expect(link("Dynamic Links")).toHaveAttribute(
      "href",
      "/dynamic_links/links"
    );
    fireEvent.click(group("Settings"));
    expect(link("Team")).toHaveAttribute("href", "/settings/team");
    expect(link("Usage & Billing")).toHaveAttribute("href", "/settings/usage");
  });

  it("hides EE groups and pages in OSS", async () => {
    await renderSidebar(false);
    expect(screen.queryByText("Engage")).not.toBeInTheDocument();
    fireEvent.click(group("Analytics"));
    fireEvent.click(group("Audience"));
    fireEvent.click(group("Developers"));
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Segments")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Export")).not.toBeInTheDocument();
  });

  it("shows EE groups and pages in enterprise", async () => {
    await renderSidebar();
    fireEvent.click(group("Engage"));
    fireEvent.click(group("Analytics"));
    expect(link("Push")).toHaveAttribute("href", "/push");
    expect(link("Revenue")).toHaveAttribute("href", "/revenue");
  });

  it("lists Home then the groups in order, Settings last", async () => {
    await renderSidebar();
    const nav = screen.getByRole("navigation");
    const rows = Array.from(
      nav.querySelectorAll('[data-sidebar="menu-button"]'),
      (el) => el.textContent
    );
    expect(rows).toEqual([
      "Home",
      "Links",
      "Audience",
      "Engage",
      "Analytics",
      "Developers",
      "Settings",
    ]);
  });

  it("has no Live Support item", async () => {
    await renderSidebar();
    expect(screen.queryByText("Live Support")).not.toBeInTheDocument();
  });

  it("is a single navigation landmark", async () => {
    await renderSidebar();
    const navs = screen.getAllByRole("navigation");
    expect(navs).toHaveLength(1);
    expect(navs[0]).toHaveAccessibleName("Main navigation");
  });

  it("remembers toggled groups", async () => {
    await renderSidebar();
    fireEvent.click(group("Audience"));
    expect(localStorage.getItem("grovs.sidebar.openGroups")).toBe(
      '["Audience"]'
    );
    fireEvent.click(group("Audience"));
    expect(group("Audience")).toHaveAttribute("data-state", "closed");
    expect(localStorage.getItem("grovs.sidebar.openGroups")).toBe("[]");
  });

  it("restores open groups on load", async () => {
    localStorage.setItem("grovs.sidebar.openGroups", '["Analytics"]');
    await renderSidebar();
    expect(group("Analytics")).toHaveAttribute("data-state", "open");
    expect(group("Links")).toHaveAttribute("data-state", "closed");
  });

  it("opens the current page's group and highlights the page", async () => {
    routeState.pathname = "/push";
    await renderSidebar();
    expect(group("Engage")).toHaveAttribute("data-state", "open");
    expect(group("Links")).toHaveAttribute("data-state", "closed");
    expect(link("Push")).toHaveAttribute("data-active", "true");
  });

  it("highlights Smart Banners, not Link Settings, on a banner page", async () => {
    routeState.pathname = "/smart_banners";
    await renderSidebar();
    expect(link("Smart Banners")).toHaveAttribute("data-active", "true");
    expect(screen.queryByText("Redirect Rules")).not.toBeInTheDocument();
  });

  it("opens Link Settings on one of its pages", async () => {
    routeState.pathname = "/dynamic_links/settings/domain";
    await renderSidebar();
    expect(link("Domain")).toHaveAttribute("data-active", "true");
    expect(link("Redirect Rules")).toHaveAttribute("data-active", "false");
  });

  it("opens the first link setting from its parent, keeping only project and env", async () => {
    routeState.query = "instance_id=9&env_type=test&status=draft&page=3";
    await renderSidebar();
    fireEvent.click(group("Links"));
    expect(link("Campaigns")).toHaveAttribute(
      "href",
      "/dynamic_links/campaigns?instance_id=9&env_type=test"
    );
    fireEvent.click(group("Link Settings"));
    expect(push).toHaveBeenCalledWith(
      "/dynamic_links/settings/redirect_rules?instance_id=9&env_type=test"
    );
  });

  it("opens another group on navigation without closing the first", async () => {
    routeState.pathname = "/push";
    const { rerender } = await renderSidebar();
    routeState.pathname = "/dynamic_links/settings/redirect_rules";
    const { AppSidebar } = await import("@/components/layout/app-sidebar");
    const { SidebarProvider } = await import("@/components/ui/sidebar");
    rerender(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );
    expect(group("Links")).toHaveAttribute("data-state", "open");
    expect(group("Engage")).toHaveAttribute("data-state", "open");
    expect(group("Link Settings")).toHaveAttribute("data-state", "open");
    expect(link("Redirect Rules")).toHaveAttribute("data-active", "true");
  });

  it("keeps the current page's group open even if saved closed", async () => {
    localStorage.setItem("grovs.sidebar.openGroups", '["Audience"]');
    routeState.pathname = "/smart_banners";
    await renderSidebar();
    expect(group("Links")).toHaveAttribute("data-state", "open");
    expect(group("Audience")).toHaveAttribute("data-state", "open");
    expect(group("Engage")).toHaveAttribute("data-state", "closed");
  });

  it("expands the icon-only sidebar and opens the group on click", async () => {
    const { container } = await renderSidebar(true, false);
    const sidebar = () => container.querySelector('[data-slot="sidebar"]');
    expect(sidebar()).toHaveAttribute("data-state", "collapsed");
    fireEvent.click(group("Audience"));
    expect(sidebar()).toHaveAttribute("data-state", "expanded");
    expect(group("Audience")).toHaveAttribute("data-state", "open");
  });

  it("on mobile toggles the group without expanding the desktop sidebar", async () => {
    const width = window.innerWidth;
    window.innerWidth = 500;
    // The mobile Sheet (Radix Dialog) needs ResizeObserver, which jsdom doesn't ship.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    try {
      vi.resetModules();
      vi.doMock("@/lib/edition", () => ({
        IS_ENTERPRISE: true,
        IS_SELF_HOSTED: false,
      }));
      const { AppSidebar } = await import("@/components/layout/app-sidebar");
      const { SidebarProvider, SidebarTrigger, useSidebar } =
        await import("@/components/ui/sidebar");
      const DesktopState = () => (
        <div data-testid="desktop">{useSidebar().state}</div>
      );
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarTrigger />
          <DesktopState />
          <AppSidebar />
        </SidebarProvider>
      );
      fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
      fireEvent.click(group("Audience"));
      expect(group("Audience")).toHaveAttribute("data-state", "open");
      expect(screen.getByTestId("desktop")).toHaveTextContent("collapsed");
      fireEvent.click(group("Audience"));
      expect(group("Audience")).toHaveAttribute("data-state", "closed");
    } finally {
      window.innerWidth = width;
      vi.unstubAllGlobals();
    }
  });
});
