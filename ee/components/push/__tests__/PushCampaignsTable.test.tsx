import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PushCampaignsTable from "../PushCampaignsTable";
import type { PushCampaign } from "@ee/types/push";

const campaign = (over: Partial<PushCampaign> = {}): PushCampaign => ({
  id: "c1",
  name: "Spring sale",
  title: "Spring is here",
  body: "Open the app",
  image_url: null,
  image: null,
  sound: null,
  data: {},
  link_id: null,
  source: "dashboard",
  status: "draft",
  scheduled_at: null,
  local_time: false,
  timezone: "UTC",
  evaluated_at: null,
  started_at: null,
  finished_at: null,
  failure_reason: null,
  audience: {
    type: "identifiers",
    recipients_count: 3,
    segment_id: null,
    segment_definition_hash: null,
  },
  report: {
    targeted: 0,
    no_channel: 0,
    not_found: 0,
    queued: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    cancelled: 0,
    held: 0,
    waiting: 0,
    error_counts: {},
    audience: { persons: null, devices: null, incomplete: false },
  },
  created_at: "2026-09-20T00:00:00Z",
  control_group: null,
  conversion: null,
  variants: null,
  test_share: null,
  winner_after_minutes: null,
  winner_by: null,
  winner_due_at: null,
  winner: null,
  updated_at: "2026-09-20T00:00:00Z",
  ...over,
});

const actions = {
  onOpen: vi.fn(),
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onCancel: vi.fn(),
};

const renderTable = (
  props: Partial<Parameters<typeof PushCampaignsTable>[0]> = {}
) =>
  render(
    <PushCampaignsTable
      campaigns={[campaign()]}
      loading={false}
      hasFilters={false}
      truncated={false}
      segmentNames={new Map()}
      actions={actions}
      {...props}
    />
  );

const openMenu = async (name = "Spring sale") =>
  userEvent.click(screen.getByRole("button", { name: `Actions for ${name}` }));

describe("PushCampaignsTable row menu", () => {
  it("offers Open, Edit, Duplicate and Cancel for a draft", async () => {
    renderTable();
    await openMenu();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("hides Edit for a non-draft status but keeps Cancel while scheduled", async () => {
    renderTable({ campaigns: [campaign({ status: "scheduled" })] });
    await openMenu();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("hides Cancel once the campaign is sent", async () => {
    renderTable({ campaigns: [campaign({ status: "sent" })] });
    await openMenu();
    expect(screen.queryByText("Cancel")).toBeNull();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
  });

  it("keeps Cancel available while sending", async () => {
    renderTable({ campaigns: [campaign({ status: "sending" })] });
    await openMenu();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is chosen", async () => {
    renderTable({ campaigns: [campaign({ status: "scheduled" })] });
    await openMenu();
    await userEvent.click(screen.getByText("Cancel"));
    expect(actions.onCancel).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled" })
    );
  });

  it("renders the New campaign CTA and the truncation note", () => {
    renderTable({ campaigns: [] });
    expect(screen.getByText("No push campaigns yet")).toBeInTheDocument();
    renderTable({ truncated: true });
    expect(
      screen.getByText(/200 most recently created push campaigns/)
    ).toBeInTheDocument();
  });

  it("shows the segment name for a segment audience via the lookup map", () => {
    renderTable({
      campaigns: [
        campaign({
          audience: {
            type: "segment",
            recipients_count: 500,
            segment_id: "seg_1",
            segment_definition_hash: "h",
          },
        }),
      ],
      segmentNames: new Map([["seg_1", "Active buyers"]]),
    });
    expect(screen.getByText("Segment: Active buyers")).toBeInTheDocument();
  });
});

describe("PushCampaignsTable paging", () => {
  it("loads the next page when the bottom scrolls into view", () => {
    let callback: IntersectionObserverCallback | null = null;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      } as unknown as typeof IntersectionObserver
    );
    const onLoadMore = vi.fn();
    renderTable({ hasMore: true, onLoadMore });
    act(() =>
      callback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/most recently created push campaigns/)
    ).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
