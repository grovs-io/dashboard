import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import SegmentsTable from "../SegmentsTable";
import type { Segment } from "@ee/types/segments";

const segment = (over: Partial<Segment> = {}): Segment => ({
  id: "s1",
  name: "Active iOS buyers",
  description: "iOS users who bought",
  definition: { version: 1, operator: "or", groups: [] },
  definition_hash: "h",
  archived: false,
  has_identifier_list: false,
  identifier_list: null,
  size: { date: "2026-09-22", persons: 38120, devices: 41230 },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-22T00:00:00Z",
  ...over,
});
const actions = {
  onEdit: vi.fn(),
  onExport: vi.fn(),
  onArchive: vi.fn(),
  onRestore: vi.fn(),
};
const renderTable = (
  props: Partial<Parameters<typeof SegmentsTable>[0]> = {}
) =>
  render(
    <TooltipProvider>
      <SegmentsTable
        segments={[segment()]}
        loading={false}
        archived={false}
        truncated={false}
        actions={actions}
        onOpen={vi.fn()}
        {...props}
      />
    </TooltipProvider>
  );

describe("SegmentsTable", () => {
  it("shows snapshot sizes with thousands separators", () => {
    renderTable();
    expect(screen.getByText("38,120")).toBeInTheDocument();
    expect(screen.getByText("41,230")).toBeInTheDocument();
  });

  it("shows a dash when no snapshot exists yet", () => {
    renderTable({ segments: [segment({ size: null })] });
    expect(screen.getAllByLabelText("Size not computed yet")).toHaveLength(2);
  });

  it("offers row actions to every member", async () => {
    const onOpen = vi.fn();
    renderTable({ onOpen });
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Active iOS buyers" })
    );
    await userEvent.click(await screen.findByText("Archive"));
    expect(actions.onArchive).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1" })
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders the empty state and the truncation note", () => {
    renderTable({ segments: [], truncated: false });
    expect(screen.getByText("No segments yet")).toBeInTheDocument();
    renderTable({ segments: [segment()], truncated: true });
    expect(screen.getByText(/200 most recently updated/)).toBeInTheDocument();
  });
});
