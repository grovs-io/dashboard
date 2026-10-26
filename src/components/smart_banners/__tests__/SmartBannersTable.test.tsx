import { describe, it, expect, vi, beforeAll } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SmartBannersTable, {
  REORDER_LOCKED_HINT,
  buildAnnouncements,
} from "../SmartBannersTable";
import { makeBanner, stubResizeObserver } from "./fixtures";

beforeAll(stubResizeObserver);

const stats = {
  views: 200,
  clicks: 50,
  dismisses: 3,
  ctr: 0.25,
  opens: 30,
  installs: 12,
};
const actions = () => ({
  onOpen: vi.fn(),
  onAction: vi.fn(),
});
const props = (
  over: Partial<Parameters<typeof SmartBannersTable>[0]> = {}
) => ({
  banners: [
    makeBanner(1, "Products", { stats, platforms: ["ios", "android"] }),
    makeBanner(2, "Blog", { status: "paused" }),
  ],
  order: [1, 2],
  loading: false,
  actions: actions(),
  onReorder: vi.fn(),
  emptyState: <p>Nothing here</p>,
  ...over,
});

describe("SmartBannersTable", () => {
  it("renders rows in order with status, platforms and stats", () => {
    render(<SmartBannersTable {...props()} />);
    const rows = screen.getAllByTestId("smart-banner-row");
    expect(within(rows[0]!).getByText("Products")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Live")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("iOS, Android")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("25.0%")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("200")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("3")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("1.5%")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("12")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Paused")).toBeInTheDocument();
  });

  it("shows the name as plain text, as the Links table does", () => {
    render(<SmartBannersTable {...props()} />);
    const name = within(screen.getAllByTestId("smart-banner-row")[0]!)
      .getByText("Products")
      .closest("td")!;
    expect(name).toHaveTextContent(/^Products$/);
    expect(name.querySelector("img, svg, [style]")).toBeNull();
  });

  it("numbers rows by priority from the full order, even when filtered", () => {
    const { rerender } = render(<SmartBannersTable {...props()} />);
    expect(
      screen.getByRole("columnheader", { name: "Priority" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId("smart-banner-priority").map((p) => p.textContent)
    ).toEqual(["1", "2"]);
    rerender(
      <SmartBannersTable
        {...props({
          banners: [makeBanner(2, "Blog")],
          order: [1, 2],
          filtered: true,
        })}
      />
    );
    expect(screen.getByTestId("smart-banner-priority")).toHaveTextContent("2");
  });

  it("moves a banner to the top or bottom with the full id list", async () => {
    const onReorder = vi.fn();
    render(
      <SmartBannersTable
        {...props({
          onReorder,
          order: [1, 2, 3],
          banners: [
            makeBanner(1, "Products"),
            makeBanner(2, "Blog"),
            makeBanner(3, "Sale"),
          ],
        })}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Blog" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Move to top" })
    );
    expect(onReorder).toHaveBeenLastCalledWith([2, 1, 3]);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Blog" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Move to bottom" })
    );
    expect(onReorder).toHaveBeenLastCalledWith([1, 3, 2]);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Products" })
    );
    expect(
      await screen.findByRole("menuitem", { name: "Move to top" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("disables Move to top and bottom while filtered, with the hint", async () => {
    const onReorder = vi.fn();
    render(<SmartBannersTable {...props({ onReorder, filtered: true })} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Blog" })
    );
    const top = await screen.findByRole("menuitem", { name: "Move to top" });
    expect(top).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("menuitem", { name: "Move to bottom" })
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.hover(top.parentElement!);
    expect(
      (await screen.findAllByText(REORDER_LOCKED_HINT)).length
    ).toBeGreaterThan(0);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it.each([
    [
      "draft",
      [
        "Publish",
        "Edit",
        "Duplicate",
        "Move to top",
        "Move to bottom",
        "Delete",
      ],
    ],
    [
      "live",
      [
        "Pause",
        "Edit",
        "Duplicate",
        "Archive",
        "Move to top",
        "Move to bottom",
      ],
    ],
    [
      "paused",
      [
        "Resume",
        "Edit",
        "Duplicate",
        "Archive",
        "Move to top",
        "Move to bottom",
        "Delete",
      ],
    ],
  ] as const)("offers a %s banner its actions", async (status, expected) => {
    render(
      <SmartBannersTable
        {...props({
          banners: [makeBanner(1, "Products", { status })],
          order: [1],
        })}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Products" })
    );
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(expected);
  });

  it("opens the same actions from the status pill", async () => {
    const a = actions();
    render(<SmartBannersTable {...props({ actions: a })} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Status of Products: Live" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Pause" })
    );
    expect(a.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      "pause"
    );
    expect(a.onOpen).not.toHaveBeenCalled();
  });

  it("shows archived banners without priority, handles or row click", async () => {
    const a = actions();
    render(
      <SmartBannersTable
        {...props({
          actions: a,
          showPriority: false,
          filtered: true,
          banners: [makeBanner(4, "Old", { status: "archived" })],
          order: [1, 2],
        })}
      />
    );
    expect(screen.queryByRole("columnheader", { name: "Priority" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reorder Old" })).toBeNull();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Old"));
    expect(a.onOpen).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Old" })
    );
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Restore",
      "Duplicate",
      "Delete",
    ]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Restore" }));
    expect(a.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      "restore"
    );
  });

  it("badges an active banner with no default link as not live", () => {
    render(
      <SmartBannersTable
        {...props({
          banners: [makeBanner(1, "Products", { default_link: null })],
          order: [1],
        })}
      />
    );
    expect(screen.getByText("Not live")).toBeInTheDocument();
  });

  it("opens on row click and Enter, but not from the drag handle", async () => {
    const a = actions();
    render(<SmartBannersTable {...props({ actions: a })} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Open smart banner Products" })
    );
    expect(a.onOpen).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "Open smart banner Blog" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(a.onOpen).toHaveBeenCalledTimes(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Reorder Products" })
    );
    expect(a.onOpen).toHaveBeenCalledTimes(2);
  });

  it("offers Resume for a paused banner", async () => {
    const a = actions();
    render(<SmartBannersTable {...props({ actions: a })} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Blog" })
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Resume" })
    );
    expect(a.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      "resume"
    );
    expect(a.onOpen).not.toHaveBeenCalled();
  });

  it("disables drag handles and menus while a reorder is pending", () => {
    render(<SmartBannersTable {...props({ reorderPending: true })} />);
    expect(
      screen.getByRole("button", { name: "Reorder Products" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Actions for Products" })
    ).toBeDisabled();
  });

  it("shows the empty state, or skeletons while loading", () => {
    const { rerender } = render(
      <SmartBannersTable {...props({ banners: [] })} />
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    rerender(<SmartBannersTable {...props({ banners: [], loading: true })} />);
    expect(screen.queryByText("Nothing here")).toBeNull();
    expect(screen.queryAllByTestId("smart-banner-row")).toHaveLength(0);
  });

  it("announces drags by banner name", () => {
    const a = buildAnnouncements([
      makeBanner(1, "Products"),
      makeBanner(2, "Blog"),
    ]);
    const over = a.onDragOver!({ active: { id: 1 }, over: { id: 2 } } as never);
    expect(over).toBe(
      "Draggable item Products was moved over droppable area Blog."
    );
  });

  it("locks reordering with a hint while filtered, keeping the menus", async () => {
    render(<SmartBannersTable {...props({ filtered: true })} />);
    const handle = screen.getByRole("button", { name: "Reorder Products" });
    expect(handle).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Actions for Products" })
    ).toBeEnabled();
    act(() => handle.parentElement!.focus());
    expect(
      (await screen.findAllByText(REORDER_LOCKED_HINT)).length
    ).toBeGreaterThan(0);
  });

  it("shows a dash for zero stats, as the Links table does", () => {
    render(
      <SmartBannersTable
        {...props({
          banners: [
            makeBanner(1, "Products", {
              stats: { ...stats, views: 0, clicks: 0, ctr: 0, installs: 0 },
            }),
          ],
        })}
      />
    );
    // views, clicks, ctr, installs are zero, and dismiss rate has no views to divide by.
    expect(
      within(screen.getByTestId("smart-banner-row")).getAllByText("-")
    ).toHaveLength(5);
  });

  it("computes the dismiss rate and dashes it when there were no views", () => {
    render(
      <SmartBannersTable
        {...props({
          banners: [
            makeBanner(1, "Products", {
              stats: { ...stats, dismisses: 25, views: 0 },
            }),
            makeBanner(2, "Blog", {
              stats: { ...stats, dismisses: 25, views: 200 },
            }),
          ],
        })}
      />
    );
    const rows = screen.getAllByTestId("smart-banner-row");
    expect(within(rows[0]!).getByText("25")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("12.5%")).toBeInTheDocument();
  });

  it("shows no results instead of the empty state while filtered", () => {
    render(<SmartBannersTable {...props({ banners: [], filtered: true })} />);
    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here")).toBeNull();
  });
});
