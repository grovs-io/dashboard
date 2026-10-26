import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyDashboardDialog, type CopyResult } from "../CopyDashboardDialog";
import { builtinDashboard } from "../builtinDashboards";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  }
});

const acquisition = builtinDashboard("acquisition")!;

function setup(
  props: Partial<{
    atLimit: boolean;
    onCreate: () => Promise<CopyResult>;
  }> = {}
) {
  const onClose = vi.fn();
  const onOpenBoard = vi.fn();
  const onCreate = vi.fn(
    props.onCreate ?? (async () => ({ id: 42, failed: [] }))
  );
  render(
    <CopyDashboardDialog
      dashboard={acquisition}
      atLimit={props.atLimit ?? false}
      onClose={onClose}
      onCreate={onCreate}
      onOpenBoard={onOpenBoard}
    />
  );
  return { onClose, onOpenBoard, onCreate, user: userEvent.setup() };
}

const create = () => screen.getByRole("button", { name: /create board/i });
const nameInput = () => screen.getByLabelText("Board name");

describe("CopyDashboardDialog", () => {
  it("prefills a focused, selected name and lists every widget with its kind", () => {
    setup();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Copy Acquisition to your boards"
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "The built-in Acquisition dashboard stays as it is."
    );
    const input = nameInput() as HTMLInputElement;
    expect(input).toHaveValue("Acquisition — my version");
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(screen.getByText("Widgets to include · 7 of 7")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual([
      "Key numbers6 metrics",
      "New usersLine chart",
      "Acquisition channelsBreakdown",
      "By platformBar list",
      "Installs by countryTop 5",
      "Top campaignsTop 5",
      "Top sourcesTop 5",
    ]);
  });

  it("toggles single widgets and all of them, and sends only the picked ones", async () => {
    const { user, onCreate } = setup();
    await user.click(screen.getByRole("checkbox", { name: /by platform/i }));
    expect(screen.getByText("Widgets to include · 6 of 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select all" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText("Widgets to include · 0 of 7")).toBeInTheDocument();
    expect(create()).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /top sources/i }));
    await user.click(create());
    expect(onCreate).toHaveBeenCalledWith("Acquisition — my version", [
      acquisition.widgets[6],
    ]);
  });

  it("needs a name", async () => {
    const { user } = setup();
    await user.clear(nameInput());
    expect(create()).toBeDisabled();
    await user.type(nameInput(), "   ");
    expect(create()).toBeDisabled();
  });

  it("explains the limit and blocks creating at 10 boards", () => {
    setup({ atLimit: true });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You already have 10 boards"
    );
    expect(create()).toBeDisabled();
  });

  it("locks the dialog while the board is created, then opens it", async () => {
    let finish: (r: CopyResult) => void = () => {};
    const { user, onOpenBoard, onClose } = setup({
      onCreate: () => new Promise<CopyResult>((r) => (finish = r)),
    });
    await user.click(create());
    expect(
      screen.getByRole("button", { name: /creating board/i })
    ).toBeDisabled();
    expect(nameInput()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    finish({ id: 42, failed: [] });
    await vi.waitFor(() => expect(onOpenBoard).toHaveBeenCalledWith(42));
  });

  it("shows API errors inline and lets you retry", async () => {
    const { user, onCreate } = setup({
      onCreate: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue({ id: 1, failed: [] }),
    });
    await user.click(create());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't create the board. Please try again."
    );
    expect(create()).toBeEnabled();
    await user.click(create());
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it("names the widgets that failed and offers to open the partial board", async () => {
    const { user, onOpenBoard } = setup({
      onCreate: async () => ({ id: 9, failed: ["Top sources", "By platform"] }),
    });
    await user.click(create());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your board was created, but these widgets couldn't be added: Top sources, By platform."
    );
    expect(onOpenBoard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Open board" }));
    expect(onOpenBoard).toHaveBeenCalledWith(9);
  });

  it("closes on Cancel", async () => {
    const { user, onClose } = setup();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
