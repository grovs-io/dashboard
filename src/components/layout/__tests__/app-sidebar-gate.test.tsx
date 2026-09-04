import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Exercises the real gate composition (role + entitlement) end to end, so the
// menu item can't drift away from "admin on an entitled project".
const state = {
  instanceId: "i1" as string | undefined,
  roles: [{ instance_id: "i1", role: "admin" }] as {
    instance_id: string;
    role: string;
  }[],
  isEnterprise: true,
  selfHosted: false,
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/edition", () => ({
  get IS_SELF_HOSTED() {
    return state.selfHosted;
  },
  IS_ENTERPRISE: true,
}));

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedInstance: state.instanceId ? { id: state.instanceId } : undefined,
  }),
}));

vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({
    user: { roles: state.roles },
    userRef: { current: null },
  }),
}));

vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: () => ({
    data: { subscription: {}, isEnterprise: state.isEnterprise },
    isLoading: false,
    isPending: false,
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
    <QueryClientProvider client={new QueryClient()}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </QueryClientProvider>
  );

const auditItem = () => screen.queryByText("Audit Logs");

describe("Audit Logs menu visibility", () => {
  beforeEach(() => {
    state.instanceId = "i1";
    state.roles = [{ instance_id: "i1", role: "admin" }];
    state.isEnterprise = true;
    state.selfHosted = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });

  it("shows for an admin on an enterprise project", () => {
    renderSidebar();
    expect(auditItem()).toBeInTheDocument();
  });

  it("hides for a non-admin on an enterprise project", () => {
    state.roles = [{ instance_id: "i1", role: "member" }];
    renderSidebar();
    expect(auditItem()).not.toBeInTheDocument();
  });

  it("hides for an admin on a non-enterprise project", () => {
    state.isEnterprise = false;
    renderSidebar();
    expect(auditItem()).not.toBeInTheDocument();
  });

  it("hides when the user is admin of a different project", () => {
    state.roles = [{ instance_id: "other", role: "admin" }];
    renderSidebar();
    expect(auditItem()).not.toBeInTheDocument();
  });

  it("shows for an admin on self-hosted without an enterprise plan", () => {
    state.selfHosted = true;
    state.isEnterprise = false;
    renderSidebar();
    expect(auditItem()).toBeInTheDocument();
  });

  it("hides for a non-admin even on self-hosted", () => {
    state.selfHosted = true;
    state.roles = [{ instance_id: "i1", role: "member" }];
    renderSidebar();
    expect(auditItem()).not.toBeInTheDocument();
  });

  it("hides when no project is selected", () => {
    state.instanceId = undefined;
    renderSidebar();
    expect(auditItem()).not.toBeInTheDocument();
  });
});
