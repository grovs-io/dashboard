import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

// jsdom has no layout, so give the responsive wrapper a fixed size.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => (
      <actual.ResponsiveContainer width={600} height={250}>
        {children}
      </actual.ResponsiveContainer>
    ),
  };
});
import { TrendAreaChart, type TrendDatum } from "../TrendAreaChart";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (
      globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }
    ).ResizeObserver = ResizeObserverStub;
  }
});

const points: TrendDatum[] = [
  { date: "2026-09-01", value: 4 },
  { date: "2026-09-02", value: 6 },
];

describe("TrendAreaChart", () => {
  it("draws the area without a previous line when no point has one", () => {
    const { container } = render(
      <TrendAreaChart data={points} granularity="day" />
    );
    expect(container.querySelector('[data-slot="chart"]')).toHaveClass(
      "h-[250px]"
    );
    expect(container.querySelector(".recharts-area")).not.toBeNull();
    expect(container.querySelector(".recharts-line")).toBeNull();
  });

  it("draws the dashed previous line when a point has previous, at the given height", () => {
    const { container } = render(
      <TrendAreaChart
        data={[
          { date: "2026-09-01", value: 4, previous: 3 },
          { date: "2026-09-02", value: 6 },
        ]}
        granularity="day"
        height={200}
      />
    );
    expect(container.querySelector('[data-slot="chart"]')).toHaveClass(
      "h-[200px]"
    );
    expect(container.querySelector(".recharts-line")).not.toBeNull();
  });
});
