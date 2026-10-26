import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewBoardBanner } from "../NewBoardBanner";
import { markNewBoard } from "../newBoardHint";

describe("NewBoardBanner", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows once on a freshly copied board and stays dismissed", async () => {
    markNewBoard(42);
    const { unmount } = render(<NewBoardBanner dashboardId={42} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your board is ready. Drag widgets to rearrange"
    );
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("status")).toBeNull();
    unmount();
    render(<NewBoardBanner dashboardId={42} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stays hidden on other boards", () => {
    markNewBoard(42);
    render(<NewBoardBanner dashboardId={7} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
