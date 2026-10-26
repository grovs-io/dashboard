import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangePicker } from "../DateRangePicker";

const today = {
  from: new Date("2026-09-25T00:00:00"),
  to: new Date("2026-09-25T23:59:59.999"),
};
const snapped = {
  from: new Date("2026-09-01T00:00:00"),
  to: new Date("2026-09-25T23:59:59.999"),
};

describe("DateRangePicker preset label", () => {
  it("drops the preset label when the date changes from outside", () => {
    const setDate = vi.fn();
    const { rerender } = render(
      <DateRangePicker
        date={today}
        setDate={setDate}
        defaultPresetLabel="Today"
      />
    );
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();

    rerender(
      <DateRangePicker
        date={snapped}
        setDate={setDate}
        defaultPresetLabel="Today"
      />
    );
    expect(
      screen.queryByRole("button", { name: "Today" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sep 1, 2026 - Sep 25, 2026" })
    ).toBeInTheDocument();
  });

  it("keeps the label when the same range comes back as a new object", () => {
    const setDate = vi.fn();
    const { rerender } = render(
      <DateRangePicker
        date={today}
        setDate={setDate}
        defaultPresetLabel="Today"
      />
    );
    rerender(
      <DateRangePicker
        date={{ from: new Date(today.from), to: new Date(today.to) }}
        setDate={setDate}
        defaultPresetLabel="Today"
      />
    );
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("keeps a clicked preset's label once the parent echoes its range back", () => {
    let committed: { from?: Date; to?: Date } | undefined;
    const setDate = vi.fn((r) => (committed = r));
    const { rerender } = render(
      <DateRangePicker date={snapped} setDate={setDate} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Sep 1, 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "Last week" }));
    rerender(
      <DateRangePicker
        date={{
          from: new Date(committed!.from!),
          to: new Date(committed!.to!),
        }}
        setDate={setDate}
      />
    );
    expect(
      screen.getAllByRole("button", { name: "Last week" }).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Sep 1, 2026/ })
    ).not.toBeInTheDocument();
  });
});
