import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableWidget } from "../TableWidget";

const data = {
  metric: "installs",
  group_by: "country",
  rows: [{ key: "RO", label: "RO", value: 3, previous: 1 }],
  other: { key: "__other__", label: "Other", value: 1, previous: null },
  total: { value: 4, previous: 2 },
};

describe("TableWidget", () => {
  it("activates a row with the keyboard and never the Other row", async () => {
    const onRowClick = vi.fn();
    render(<TableWidget data={data} onRowClick={onRowClick} />);
    const row = screen.getByRole("button", { name: "Romania" });
    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith("RO", "Romania");
    expect(screen.queryByRole("button", { name: "Other" })).toBeNull();
    expect(screen.getByText("vs previous")).toBeInTheDocument();
  });
});
