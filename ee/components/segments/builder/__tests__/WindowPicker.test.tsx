import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WindowPicker, { windowLabel } from "../WindowPicker";

describe("WindowPicker", () => {
  it("describes the window on its trigger", () => {
    expect(windowLabel(undefined)).toBe("any time");
    expect(windowLabel({ last_days: 1 })).toBe("in the last 1 day");
    expect(windowLabel({ from: "2026-09-01", to: "2026-09-10" })).toBe(
      "between Sep 1 and Sep 10, 2026"
    );
  });

  it("clamps a rolling window to the cap", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WindowPicker
        value={{ last_days: 30 }}
        onChange={onChange}
        capDays={90}
      />
    );
    await user.click(screen.getByLabelText("Time window"));
    await user.click(
      screen.getByRole("radio", { name: "Custom number of days" })
    );
    fireEvent.change(screen.getByLabelText("Days"), {
      target: { value: "400" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ last_days: 90 });
    fireEvent.change(screen.getByLabelText("Days"), { target: { value: "0" } });
    expect(onChange).toHaveBeenLastCalledWith({ last_days: 1 });
    expect(screen.getByText("Up to 90 days back.")).toBeInTheDocument();
  });

  it("offers presets and a date range ending today", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WindowPicker
        value={undefined}
        onChange={onChange}
        capDays={90}
        today={new Date(2026, 8, 23)}
      />
    );
    await user.click(screen.getByLabelText("Time window"));
    expect(
      screen.queryByRole("radio", { name: "Last 180 days" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Last 30 days" }));
    expect(onChange).toHaveBeenCalledWith({ last_days: 30 });
    await user.click(screen.getByLabelText("Time window"));
    await user.click(screen.getByRole("radio", { name: "Date range" }));
    expect(onChange).toHaveBeenCalledWith({
      from: "2026-09-23",
      to: "2026-09-23",
    });
  });
});
