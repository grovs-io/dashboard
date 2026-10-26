import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import RevenueSettingsDialog from "../RevenueSettingsDialog";

const renderDialog = (
  admin: boolean,
  onSave = vi.fn().mockResolvedValue(undefined)
) => {
  render(
    <RevenueSettingsDialog
      open
      onOpenChange={() => {}}
      admin={admin}
      enabled
      saving={false}
      onSave={onSave}
    />
  );
  return onSave;
};

describe("RevenueSettingsDialog", () => {
  it("asks before turning tracking off, then saves", async () => {
    const onSave = renderDialog(true);
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("Revenue tracking is off")).toBeInTheDocument();
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Turn off" }));
    expect(onSave).toHaveBeenCalledWith(false);
  });

  it("is read-only for non-admins", () => {
    renderDialog(false);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(
      screen.getByText("Only an admin can change these.")
    ).toBeInTheDocument();
  });
});
