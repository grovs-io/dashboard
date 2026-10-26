import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarListWidget } from "../BarListWidget";

const data = {
  metric: "installs",
  group_by: "country",
  rows: [
    { key: "RO", label: "RO", value: 30, previous: 20 },
    { key: "DE", label: "DE", value: 10, previous: 10 },
  ],
  other: { key: "__other__", label: "Other", value: 5, previous: null },
  total: { value: 45, previous: 30 },
};

describe("BarListWidget", () => {
  it("renders labelled rows with values, shares and deltas, plus Other", () => {
    render(<BarListWidget data={data} />);
    expect(screen.getByText("Romania")).toBeInTheDocument();
    expect(screen.getByText("Germany")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument(); // RO delta vs previous 20
  });

  it("calls onRowClick with key and label for real rows only", async () => {
    const onRowClick = vi.fn();
    render(<BarListWidget data={data} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByRole("button", { name: /Romania/ }));
    expect(onRowClick).toHaveBeenCalledWith("RO", "Romania");
    expect(screen.queryByRole("button", { name: /Other/ })).toBeNull();
  });
  it("compact mode flows rows into two ranked columns", () => {
    const { container } = render(<BarListWidget data={data} compact />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("grid-cols-2");
    // Three rows (RO, DE, Other) split as two rows per column.
    expect(grid.style.gridTemplateRows).toBe("repeat(2, auto)");
  });

  it("default mode stays a single stacked list", () => {
    const { container } = render(<BarListWidget data={data} />);
    const list = container.firstElementChild as HTMLElement;
    expect(list.className).toContain("flex-col");
    expect(list.style.gridTemplateRows).toBe("");
  });

  it("turns Other into a Show more button when more rows can be requested", async () => {
    const onShowMore = vi.fn();
    render(<BarListWidget data={data} onShowMore={onShowMore} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Show more values" })
    );
    expect(onShowMore).toHaveBeenCalledTimes(1);
  });

  it("keeps Other as plain text without onShowMore", () => {
    render(<BarListWidget data={data} />);
    expect(
      screen.queryByRole("button", { name: "Show more values" })
    ).toBeNull();
  });
});
