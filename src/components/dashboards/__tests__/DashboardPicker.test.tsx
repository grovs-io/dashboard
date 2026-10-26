import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPicker, MAX_DASHBOARDS, boardMeta } from "../DashboardPicker";

// Radix popper content needs ResizeObserver, which jsdom doesn't ship.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (
      globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
    ).ResizeObserver = ResizeObserverStub;
  }
});

const dashboards = [
  {
    id: 1,
    name: "Growth",
    position: 0,
    widgets: [],
    created_at: "",
    updated_at: "",
  },
  {
    id: 2,
    name: "Marketing",
    position: 1,
    widgets: [],
    created_at: "",
    updated_at: "",
  },
];

function setupUser() {
  return userEvent.setup({ pointerEventsCheck: 0 });
}

async function openMenu(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole("button", { name: "Choose dashboard" }));
}

describe("DashboardPicker", () => {
  it("shows the active dashboard name on the trigger", () => {
    const { rerender } = render(
      <DashboardPicker
        dashboards={dashboards}
        active="2"
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Choose dashboard" }).textContent
    ).toContain("Marketing");

    rerender(
      <DashboardPicker
        dashboards={dashboards}
        active=""
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Choose dashboard" }).textContent
    ).toContain("Overview");
  });

  it("lists Overview, every dashboard and New board in the menu", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    render(
      <DashboardPicker
        dashboards={dashboards}
        active=""
        onSelect={onSelect}
        onCreate={onCreate}
      />
    );
    await openMenu(user);

    expect(
      screen.getByRole("menuitemradio", { name: /overview/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /growth/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /marketing/i })
    ).toBeInTheDocument();
    const newDashboardItem = screen.getByRole("menuitem", {
      name: /new board/i,
    });
    expect(newDashboardItem).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: /growth/i }));
    expect(onSelect).toHaveBeenCalledWith("1");

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: /new board/i }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("disables New board at the limit", async () => {
    const user = setupUser();
    const ten = Array.from({ length: MAX_DASHBOARDS }, (_, i) => ({
      id: i + 1,
      name: `D${i}`,
      position: i,
      widgets: [],
      created_at: "",
      updated_at: "",
    }));
    render(
      <DashboardPicker
        dashboards={ten}
        active=""
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    await openMenu(user);

    const newDashboardItem = screen.getByRole("menuitem", {
      name: /new board/i,
    });
    expect(newDashboardItem).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText(`Limit of ${MAX_DASHBOARDS} dashboards reached`)
    ).toBeInTheDocument();
  });

  it("lists the five built-ins first, then Your boards, then New board", async () => {
    const user = setupUser();
    render(
      <DashboardPicker
        dashboards={dashboards}
        active=""
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    await openMenu(user);
    const menu = screen.getByRole("menu");
    const items = within(menu)
      .getAllByRole("menuitemradio")
      .map((el) => el.getAttribute("title"));
    expect(items).toEqual([
      "Overview",
      "Acquisition",
      "Engagement",
      "Revenue",
      "Links",
      "Growth",
      "Marketing",
    ]);
    expect(
      within(menu).getByRole("menuitem", { name: /new board/i })
    ).toBeInTheDocument();
    const labels = within(menu)
      .getAllByText(/^(Built-in|Your boards)$/)
      .map((el) => el.textContent);
    expect(labels).toEqual(["Built-in", "Your boards"]);
    expect(within(menu).getByText("2/10")).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitemradio", { name: "Engagement" })
    ).toHaveAccessibleDescription("Who comes back and what they do");
    expect(within(menu).getAllByText("No widgets yet")).toHaveLength(2);
  });

  it("hides Your boards when there are none", async () => {
    const user = setupUser();
    render(
      <DashboardPicker
        dashboards={[]}
        active=""
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    await openMenu(user);
    expect(screen.queryByText("Your boards")).not.toBeInTheDocument();
  });

  it("selects a built-in by its key and shows it on the trigger", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const { rerender } = render(
      <DashboardPicker
        dashboards={dashboards}
        active=""
        onSelect={onSelect}
        onCreate={() => {}}
      />
    );
    await openMenu(user);
    await user.click(screen.getByRole("menuitemradio", { name: "Revenue" }));
    expect(onSelect).toHaveBeenCalledWith("revenue");
    rerender(
      <DashboardPicker
        dashboards={dashboards}
        active="revenue"
        onSelect={onSelect}
        onCreate={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Choose dashboard" })
    ).toHaveTextContent("Revenue");
  });

  it("marks the selected row with a check, not a radio dot", async () => {
    const user = setupUser();
    render(
      <DashboardPicker
        dashboards={dashboards}
        active="acquisition"
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    await openMenu(user);
    const row = screen.getByRole("menuitemradio", { name: "Acquisition" });
    expect(row).toHaveAttribute("aria-checked", "true");
    expect(row.querySelector("svg.lucide-check")).not.toBeNull();
    expect(
      screen
        .getByRole("menuitemradio", { name: "Overview" })
        .querySelector("svg.lucide-check")
    ).toBeNull();
  });

  it("finds boards by name once there are more than six", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: i === 3 ? "Investor update" : `Board ${i}`,
      position: i,
      widgets: [],
      created_at: "",
      updated_at: "",
    }));
    render(
      <DashboardPicker
        dashboards={many}
        active=""
        onSelect={onSelect}
        onCreate={() => {}}
      />
    );
    await openMenu(user);
    const search = screen.getByRole("textbox", { name: "Find a board" });
    await user.type(search, "inv");
    expect(search).toHaveValue("inv");
    const boards = screen
      .getAllByRole("menuitemradio")
      .map((el) => el.getAttribute("title"))
      .slice(5);
    expect(boards).toEqual(["Investor update"]);
    await user.click(
      screen.getByRole("menuitemradio", { name: "Investor update" })
    );
    expect(onSelect).toHaveBeenCalledWith("4");
  });

  it("has no search box with six boards or fewer", async () => {
    const user = setupUser();
    render(
      <DashboardPicker
        dashboards={dashboards}
        active=""
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    await openMenu(user);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("falls back to Overview when the active id no longer exists", () => {
    render(
      <DashboardPicker
        dashboards={dashboards}
        active="99"
        onSelect={() => {}}
        onCreate={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Choose dashboard" })
    ).toHaveTextContent("Overview");
  });
});

describe("boardMeta", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const w = (updated_at: string) => ({ updated_at }) as never;
  const board = (over: object) =>
    ({
      id: 1,
      name: "B",
      position: 0,
      widgets: [],
      created_at: "2026-10-12T09:00:00Z",
      updated_at: "2026-10-12T09:00:00Z",
      ...over,
    }) as never;

  it("says No widgets yet for an empty board", () => {
    expect(boardMeta(board({}), now)).toBe("No widgets yet");
  });

  it("shows the created date when nothing changed since", () => {
    expect(
      boardMeta(board({ widgets: [w("2026-10-12T09:00:10Z")] }), now)
    ).toBe("1 widget · created 12 Oct");
  });

  it("counts a widget edit as an edit of the board", () => {
    const meta = boardMeta(
      board({
        widgets: [w("2026-10-12T09:00:10Z"), w("2026-10-19T12:00:00Z")],
      }),
      now
    );
    expect(meta).toMatch(/^2 widgets · edited \d+ days? ago$/);
  });

  it("says edited just now within a minute", () => {
    const recent = new Date(Date.now() - 5_000).toISOString();
    expect(boardMeta(board({ widgets: [w(recent)] }))).toBe(
      "1 widget · edited just now"
    );
  });
});
