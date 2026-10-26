import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/queries/useMetricQuery", () => ({ useMetricQuery: vi.fn() }));
import { useMetricQuery } from "@/hooks/queries/useMetricQuery";
import { ApiError } from "@/lib/ApiError";
import { WidgetRenderer } from "../WidgetRenderer";

const base = { start_date: "2026-09-01", end_date: "2026-09-30" };
const query = { metric: "installs" as const, group_by: "country" };

describe("WidgetRenderer", () => {
  beforeEach(() => vi.mocked(useMetricQuery).mockReset());

  it("passes serialised params to the hook and renders the bar list", () => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: {
        metric: "installs",
        group_by: "country",
        rows: [{ key: "RO", label: "RO", value: 3 }],
        other: null,
        total: { value: 3 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
    render(
      <WidgetRenderer projectId="p1" base={base} query={query} viz="bar" />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      { ...base, metric: "installs", group_by: "country" },
      true
    );
    expect(screen.getByText("Romania")).toBeInTheDocument();
  });

  it.each([
    ["line", 5],
    ["bar", 20],
  ] as const)("requests the right series limit for %s", (viz, limit) => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
    } as never);
    render(
      <WidgetRenderer
        projectId="p1"
        base={base}
        query={{ ...query, granularity: "day", limit: 20 }}
        viz={viz}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ limit }),
      true
    );
  });

  it("shows the empty text when there are no rows", () => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: {
        metric: "installs",
        group_by: "country",
        rows: [],
        other: null,
        total: { value: 0 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
    render(
      <WidgetRenderer
        projectId="p1"
        base={base}
        query={query}
        viz="bar"
        emptyText="Nothing here"
      />
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it.each(["bar", "number"] as const)(
    "shows the empty text instead of throwing on a response without rows (%s)",
    (viz) => {
      vi.mocked(useMetricQuery).mockReturnValue({
        data: {},
        isLoading: false,
        isFetching: false,
        error: null,
      } as never);
      render(
        <WidgetRenderer
          projectId="p1"
          base={base}
          query={query}
          viz={viz}
          emptyText="Nothing here"
        />
      );
      expect(screen.getByText("Nothing here")).toBeInTheDocument();
    }
  );

  it("shows the analytics error copy on failure", () => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: new ApiError("too big", 422, "query_too_heavy", {
        error: "too big",
        error_code: "query_too_heavy",
      }),
    } as never);
    render(
      <WidgetRenderer projectId="p1" base={base} query={query} viz="bar" />
    );
    expect(screen.getByText(/too heavy/i)).toBeInTheDocument();
  });

  it("does not fetch when disabled", () => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    } as never);
    render(
      <WidgetRenderer
        projectId="p1"
        base={base}
        query={query}
        viz="bar"
        enabled={false}
      />
    );
    expect(useMetricQuery).toHaveBeenCalledWith("p1", expect.anything(), false);
  });

  it("does not wire row clicks while showing placeholder data", () => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: {
        metric: "installs",
        group_by: "country",
        rows: [{ key: "RO", label: "RO", value: 3 }],
        other: null,
        total: { value: 3 },
      },
      isLoading: false,
      isFetching: true,
      isPlaceholderData: true,
      error: null,
    } as never);
    render(
      <WidgetRenderer
        projectId="p1"
        base={base}
        query={query}
        viz="bar"
        onRowClick={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: /Romania/ })).toBeNull();
  });

  it("dims placeholder data and marks it busy", () => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: {
        metric: "installs",
        group_by: "country",
        rows: [{ key: "RO", label: "RO", value: 3 }],
        other: null,
        total: { value: 3 },
      },
      isLoading: false,
      isFetching: true,
      isPlaceholderData: true,
      error: null,
    } as never);
    const { container } = render(
      <WidgetRenderer projectId="p1" base={base} query={query} viz="bar" />
    );
    const wrapper = container.querySelector("[aria-busy]");
    expect(wrapper).toHaveAttribute("aria-busy", "true");
    expect(wrapper).toHaveClass("opacity-60");
    expect(wrapper).toHaveTextContent("Romania");
  });

  it("does not dim fresh data", () => {
    vi.mocked(useMetricQuery).mockReturnValue({
      data: {
        metric: "installs",
        group_by: "country",
        rows: [{ key: "RO", label: "RO", value: 3 }],
        other: null,
        total: { value: 3 },
      },
      isLoading: false,
      isFetching: false,
      isPlaceholderData: false,
      error: null,
    } as never);
    const { container } = render(
      <WidgetRenderer projectId="p1" base={base} query={query} viz="bar" />
    );
    expect(container.querySelector("[aria-busy]")).toBeNull();
  });
});
