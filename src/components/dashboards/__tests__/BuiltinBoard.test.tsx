import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/queries/useMetricQuery", () => ({ useMetricQuery: vi.fn() }));
vi.mock("../PanelWidget", () => ({
  PanelWidget: (p: { panel: string }) => <div>panel:{p.panel}</div>,
}));
import { useMetricQuery } from "@/hooks/queries/useMetricQuery";
import { BuiltinBoard } from "../BuiltinBoard";
import { BUILTIN_DASHBOARDS, builtinDashboard } from "../builtinDashboards";
import type { MetricQueryParams } from "@/types";

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

const ROWS: Record<string, { key: string; label: string }> = {
  country: { key: "US", label: "US" },
  link_id: { key: "56006", label: "Summer Sale" },
  campaign_id: { key: "12", label: "Summer 2026" },
  tracking_source: { key: "instagram", label: "instagram" },
  platform: { key: "ios", label: "ios" },
  event_name: { key: "add_to_cart", label: "add_to_cart" },
  app_version: { key: "4.2.0", label: "4.2.0" },
};

const base = { start_date: "2026-10-01", end_date: "2026-10-14" };
const renderBoard = (key: string, onRowClick = vi.fn(), rangeSpanDays = 13) => {
  render(
    <BuiltinBoard
      dashboard={builtinDashboard(key)!}
      projectId="p1"
      base={base}
      pageFilters={[]}
      granularity="day"
      limits={{ rangeSpanDays }}
      onRowClick={onRowClick}
    />
  );
  return onRowClick;
};

describe("BuiltinBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMetricQuery).mockImplementation((_p, params) => {
      const row = ROWS[(params as MetricQueryParams).group_by ?? ""];
      return {
        data: {
          metric: params!.metric,
          group_by: params!.group_by ?? null,
          rows: row ? [{ ...row, value: 10 }] : [],
          other: null,
          total: { value: 10 },
        },
        isLoading: false,
        error: null,
        isPlaceholderData: false,
      } as never;
    });
  });

  it.each(BUILTIN_DASHBOARDS.filter((d) => d.key).map((d) => [d.key]))(
    "renders %s read-only: no drag handles or widget menus",
    (key) => {
      renderBoard(key);
      const def = builtinDashboard(key)!;
      const kpi = def.widgets[0]!;
      expect(
        screen.getByRole("region", { name: def.name })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Drag to reorder" })
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Widget actions" })
      ).toBeNull();
      expect(
        screen.getByText(`panel:${kpi.kind === "panel" ? kpi.panel : ""}`)
      ).toBeInTheDocument();
      // The KPI row has no title of its own.
      expect(screen.queryByText(kpi.title)).toBeNull();
      for (const w of def.widgets.slice(1))
        expect(screen.getAllByText(w.title).length).toBeGreaterThan(0);
    }
  );

  it("shows the short hints and a View all link instead of generated subtitles", () => {
    renderBoard("links");
    expect(screen.getAllByText("By views")).toHaveLength(2);
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.queryByText(/Count of|date & platform only/)).toBeNull();
    expect(
      screen
        .getAllByRole("link", { name: /view all/i })
        .map((a) => a.getAttribute("href"))
    ).toEqual(["/dynamic_links/links", "/dynamic_links/campaigns"]);
  });

  it("stretches cards in a row to the same height", () => {
    renderBoard("acquisition");
    const card = screen.getByText("Installs by country").closest(".flex-1");
    expect(card?.parentElement?.className).toContain("flex-col");
  });

  it("opens a campaign row on its page", async () => {
    const onRowClick = renderBoard("acquisition");
    await userEvent.click(screen.getByRole("button", { name: "Summer 2026" }));
    expect(onRowClick).toHaveBeenCalledWith({ kind: "campaign", id: "12" });
  });

  it.each([
    ["acquisition", "United States", "country", "US"],
    ["acquisition", "instagram", "tracking_source", "instagram"],
    ["engagement", "add_to_cart", "event_name", "add_to_cart"],
    ["engagement", "Opens by app version", "app_version", "4.2.0"],
  ])(
    "sends a %s row (%s) to the Events Explorer filtered by %s",
    async (key, name, field, value) => {
      const onRowClick = renderBoard(key);
      const target =
        name === "Opens by app version"
          ? screen.getByRole("button", { name: value })
          : screen.getByRole("button", { name });
      await userEvent.click(target);
      const arg = onRowClick.mock.calls[0]![0];
      expect(arg.kind).toBe("explorer");
      const chips = JSON.parse(
        new URL(arg.href, "http://x").searchParams.get("filters")!
      );
      expect(chips).toContainEqual(
        expect.objectContaining({ f: field, v: value })
      );
    }
  );

  it("opens a top link row in the link dialog", async () => {
    const onRowClick = renderBoard("links");
    await userEvent.click(screen.getByRole("button", { name: "Summer Sale" }));
    expect(onRowClick).toHaveBeenCalledWith({ kind: "link", id: "56006" });
  });

  it("renders link_views by country rows as plain text, not buttons", () => {
    renderBoard("links");
    expect(screen.getByText("United States")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "United States" })).toBeNull();
  });

  it.each([91, 181])(
    "runs every Acquisition widget on a %s-day range (no raw-limit gating)",
    (days) => {
      renderBoard("acquisition", vi.fn(), days);
      const calls = vi.mocked(useMetricQuery).mock.calls;
      expect(calls.length).toBe(4);
      expect(calls.every((c) => c[2] === true)).toBe(true);
      expect(screen.queryByText(/limited to/)).toBeNull();
    }
  );

  it("shows the range-limit message past the raw counter cap, not empty data", () => {
    renderBoard("acquisition", vi.fn(), 400);
    // Campaigns and sources read raw events; platform and country use rollups.
    expect(
      screen.getAllByText(/reads raw events and is limited to 366 days/)
    ).toHaveLength(2);
    expect(screen.queryByText("No data for this selection")).toBeNull();
  });

  it("hides the (none) bucket from top lists but keeps Other", () => {
    vi.mocked(useMetricQuery).mockImplementation(
      (_p, params) =>
        ({
          data: {
            metric: params!.metric,
            group_by: params!.group_by ?? null,
            rows:
              params!.group_by === "tracking_source"
                ? [
                    { key: "", label: "", value: 39 },
                    { key: "instagram", label: "instagram", value: 40 },
                  ]
                : [],
            other: { key: "__other__", label: "Other", value: 21 },
            total: { value: 100 },
          },
          isLoading: false,
          error: null,
          isPlaceholderData: false,
        }) as never
    );
    renderBoard("acquisition");
    expect(screen.queryByText("(none)")).toBeNull();
    const row = screen.getByRole("button", { name: "instagram" });
    // Share among real sources: 40 of 61.
    expect(row).toHaveTextContent("66%");
    expect(screen.getAllByText("Other").length).toBeGreaterThan(0);
  });
});
