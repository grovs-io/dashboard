import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { catalogue } from "@ee/lib/__tests__/fixtures";
import type { SegmentCondition, SegmentGroup } from "@ee/types/segments";
import ConditionRow from "../ConditionRow";

vi.mock("@/lib/api", () => ({
  GET: vi.fn().mockResolvedValue({
    data: { links: [], meta: { total_pages: 0, total_entries: 0 } },
  }),
  POST: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const renderRow = (
  condition: SegmentCondition,
  group: SegmentGroup = { operator: "and", conditions: [condition] },
  over = {}
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <ConditionRow
          projectId="p1"
          condition={condition}
          group={group}
          catalogue={catalogue}
          hasIdentifierList={false}
          issues={[]}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          {...over}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );

describe("ConditionRow", () => {
  it("renders the editor that matches the condition type", () => {
    renderRow({ type: "event", any: true });
    expect(screen.getByLabelText("Event target")).toBeInTheDocument();
    renderRow({
      type: "device",
      field: "platform",
      op: "is",
      value: [],
      mode: "current",
    });
    expect(screen.getByLabelText("Device field")).toBeInTheDocument();
    renderRow({
      type: "profile",
      field: "properties.plan",
      op: "is",
      value: [],
    });
    expect(screen.getByLabelText("Profile property key")).toHaveTextContent(
      "plan"
    );
    renderRow({ type: "first_seen", op: "gte", value: "2026-01-01" });
    expect(screen.getByLabelText("First seen date")).toHaveTextContent(
      "Jan 1, 2026"
    );
    renderRow({ type: "identifier", op: "is_set" });
    expect(screen.getByLabelText("Identifier operator")).toBeInTheDocument();
    renderRow({
      type: "acquisition",
      field: "tracking_source",
      op: "is",
      value: ["ads"],
      window: { last_days: 30 },
    });
    expect(screen.getByText("ads")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Acquired via")).getByLabelText(
        "Time window"
      )
    ).toHaveTextContent("in the last 30 days");
    renderRow({ type: "purchase", count: 2 });
    expect(screen.getByLabelText("Minimum purchases")).toHaveValue(2);
  });

  it("shows 'did not' as chosen and offers a fix when the group has no positive condition", async () => {
    const onAddPositive = vi.fn();
    renderRow({ type: "event", any: true, negate: true }, undefined, {
      onAddPositive,
    });
    expect(screen.getByLabelText("Did or did not")).toHaveTextContent(
      "did not"
    );
    expect(screen.getByText(/needs a positive condition/)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Add “did any activity”/ }));
    expect(onAddPositive).toHaveBeenCalled();
  });

  it("never offers 'Any time' for event or purchase windows", async () => {
    const user = userEvent.setup();
    for (const condition of [
      { type: "event", any: true, window: { last_days: 30 } },
      { type: "purchase", count: 1, window: { last_days: 90 } },
    ] as SegmentCondition[]) {
      const { unmount } = renderRow(condition);
      await user.click(screen.getByLabelText("Time window"));
      expect(
        screen.queryByRole("radio", { name: "Any time" })
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("shows the row's issues", () => {
    renderRow({ type: "event" }, undefined, {
      issues: [
        "Choose which event: any activity, a built-in event or a custom event.",
      ],
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose which event: any activity, a built-in event or a custom event."
    );
  });

  it("labels the row with its type", () => {
    renderRow({ type: "identifier", op: "is_set" });
    expect(screen.getByLabelText("Identifier")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove condition" })
    ).toBeInTheDocument();
  });
});
