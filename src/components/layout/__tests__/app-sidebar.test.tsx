import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const accessState = { allowed: false };
const routeState = { pathname: "/settings" };

vi.mock("next/navigation", () => ({
  usePathname: () => routeState.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedInstance: { id: "i1" } }),
}));

vi.mock("@/hooks/queries/useAuditQueries", () => ({
  useAuditLogAccess: () => ({
    allowed: accessState.allowed,
    isResolving: false,
  }),
}));

vi.mock("@/components/layout/team-switcher", () => ({
  ProjectSwitcher: () => <div>switcher</div>,
}));
vi.mock("@/components/layout/nav-user", () => ({
  NavUser: () => <div>user</div>,
}));
vi.mock("@/components/layout/nav-support", () => ({
  NavSupport: () => <div>support</div>,
}));

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const renderSidebar = () =>
  render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  );

describe("AppSidebar audit logs entry", () => {
  beforeEach(() => {
    accessState.allowed = false;
    // Inside the Settings section, so the collapsible renders its children.
    routeState.pathname = "/settings";
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

  it("shows Audit Logs beside Settings for an entitled admin", () => {
    accessState.allowed = true;
    renderSidebar();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
  });

  it("hides Audit Logs when access is not allowed", () => {
    renderSidebar();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
  });

  it("links Audit Logs to its own top-level route", () => {
    accessState.allowed = true;
    renderSidebar();
    expect(screen.getByText("Audit Logs").closest("a")).toHaveAttribute(
      "href",
      "/audit_logs"
    );
  });

  it("leaves Settings a plain item, not a section", () => {
    accessState.allowed = true;
    renderSidebar();
    expect(screen.getByText("Settings").closest("a")).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(screen.queryByText("General")).not.toBeInTheDocument();
  });
});
