import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import CancelPlanDialog from "../settings/CancelPlanDialog";

function renderDialog() {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  render(
    <CancelPlanDialog
      open
      onOpenChange={onOpenChange}
      planName="Growth"
      description="You keep access until Oct 20, 2027."
      onConfirm={onConfirm}
    />
  );
  return { onOpenChange, onConfirm };
}

describe("CancelPlanDialog", () => {
  it("shows the plan name and description with Keep plan focused", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Cancel Growth?");
    expect(
      screen.getByText("You keep access until Oct 20, 2027.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep plan" })).toHaveFocus();
  });

  it("Keep plan closes without confirming", async () => {
    const { onOpenChange, onConfirm } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Keep plan" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Cancel plan confirms", async () => {
    const { onConfirm } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
