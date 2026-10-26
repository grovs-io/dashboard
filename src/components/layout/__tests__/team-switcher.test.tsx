import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const instances = [
  { id: 1, name: "tet222", production: { name: "tet222" } },
  { id: 2, name: "Segments Demo", production: { name: "Segments Demo" } },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({
    selectedInstance: instances[1],
    setSelectedInstance: vi.fn(),
  }),
}));
vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({ fetchCurrentUser: vi.fn() }),
}));
vi.mock("@/hooks/queries/useInstanceQueries", () => ({
  useInstancesQuery: () => ({ data: instances }),
}));
vi.mock("@/hooks/mutations/useInstanceMutations", () => ({
  useCreateInstanceMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/components/sidebar/ProjectFormDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuButton: ({ children, ...p }: { children: ReactNode }) => (
    <button {...p}>{children}</button>
  ),
  useSidebar: () => ({ isMobile: false }),
}));

import { ProjectSwitcher } from "@/components/layout/team-switcher";

describe("ProjectSwitcher", () => {
  it("marks the selected project in the list", async () => {
    render(<ProjectSwitcher />);
    await userEvent.click(
      screen.getByRole("button", { name: /segments demo/i })
    );

    const current = screen.getByRole("menuitem", { name: /segments demo/i });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current.className).toContain("bg-muted");
    expect(current.querySelector("svg.lucide-check")).not.toBeNull();

    const other = screen.getByRole("menuitem", { name: /tet222/i });
    expect(other).not.toHaveAttribute("aria-current");
    expect(other.querySelector("svg.lucide-check")).toBeNull();
  });
});
