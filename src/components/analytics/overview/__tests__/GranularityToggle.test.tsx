import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GranularityToggle } from "../GranularityToggle";

describe("GranularityToggle", () => {
  it("renders the three options with the active one selected", () => {
    render(<GranularityToggle value="week" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Day" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("calls onChange with the clicked granularity", async () => {
    const onChange = vi.fn();
    render(<GranularityToggle value="day" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Month" }));
    expect(onChange).toHaveBeenCalledWith("month");
  });
});
