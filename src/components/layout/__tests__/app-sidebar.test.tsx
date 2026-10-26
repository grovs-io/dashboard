import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const accessState = { allowed: false };
const routeState = { pathname: "/settings/team" };

vi.mock("next/navigation", () => ({
  usePathname: () => routeState.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedInstance: { id: "i1" } }),
}));

vi.mock("@ee/hooks/queries/useAuditQueries", () => ({
  useAuditLogAccess: () => ({
    allowed: accessState.allowed,
    isResolving: false,
  }),
}));

vi.mock("@/components/layout/team-switcher", () => ({
  ProjectSwitcher: () => <div>switcher</div>,
}));
vi.mock("@/components/layout/SetupSidebarEntry", () => ({
  SetupSidebarEntry: () => null,
}));
vi.mock("@/components/layout/nav-user", () => ({
  NavUser: () => <div>user</div>,
}));

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const renderSidebar = () =>
  render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );

describe("AppSidebar settings section", () => {
  beforeEach(() => {
    accessState.allowed = false;
    routeState.pathname = "/settings/team";
    localStorage.clear();
    // jsdom has no matchMedia; ui/sidebar's mobile check needs it.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });

  it("keeps the main sections alongside settings", () => {
    renderSidebar();
    for (const group of ["Audience", "Developers"])
      fireEvent.click(screen.getByText(group).closest("button")!);
    expect(screen.getByText("Visitors")).toBeInTheDocument();
    expect(screen.getByText("Team").closest("a")).toHaveAttribute(
      "href",
      "/settings/team"
    );
    expect(screen.getByText("Developers")).toBeInTheDocument();
    expect(screen.getByText("API Key").closest("a")).toHaveAttribute(
      "href",
      "/settings/developers/access_key"
    );
    expect(screen.getByText("SDK Setup")).toBeInTheDocument();
  });

  it("shows the developer pages when inside them", () => {
    routeState.pathname = "/settings/developers/ios_setup";
    renderSidebar();
    expect(screen.getByText("iOS").closest("a")).toHaveAttribute(
      "data-active",
      "true"
    );
    expect(screen.getByText("API Key").closest("a")).toHaveAttribute(
      "data-active",
      "false"
    );
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });

  it("shows Audit Logs for an entitled admin", () => {
    accessState.allowed = true;
    renderSidebar();
    expect(screen.getByText("Audit Logs").closest("a")).toHaveAttribute(
      "href",
      "/settings/audit_logs"
    );
  });

  it("hides Audit Logs when access is not allowed", () => {
    renderSidebar();
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
  });
});
