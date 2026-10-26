import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ReachFunnel from "../ReachFunnel";
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
  status: "sent",
  scheduled_at: null,
  local_time: false,
  timezone: "UTC",
  evaluated_at: null,
  started_at: null,
  finished_at: "2026-09-22T00:00:00Z",
  failure_reason: null,
  audience: {
    type: "segment",
    recipients_count: 1200,
    segment_id: "seg_1",
    segment_definition_hash: "h",
  },
  report: {
    targeted: 1200,
    no_channel: 10,
    not_found: 5,
    queued: 0,
    delivered: 1150,
    failed: 35,
    opened: 400,
    cancelled: 0,
    held: 0,
    waiting: 0,
    error_counts: { Unregistered: 30, "404": 5 },
    audience: { persons: 1200, devices: 1300, incomplete: false },
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
  updated_at: "2026-09-22T00:00:00Z",
  ...over,
});

describe("ReachFunnel", () => {
  it("shows the eight hero metrics in order with their values", () => {
    render(<ReachFunnel campaign={campaign()} />);
    const labels = [
      "Targeted",
      "No channel",
      "Not found",
      "Cancelled",
      "Queued",
      "Delivered",
      "Failed",
      "Opened",
    ];
    for (const label of labels)
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(screen.getByText("1,150")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
  });

  it("shows the incomplete badge for a segment audience missing retained data", () => {
    render(
      <ReachFunnel
        campaign={campaign({
          report: {
            ...campaign().report,
            audience: { persons: 1200, devices: 1300, incomplete: true },
          },
        })}
      />
    );
    expect(screen.getByText("incomplete")).toBeInTheDocument();
  });

  it("does not show the incomplete badge when it is false", () => {
    render(<ReachFunnel campaign={campaign()} />);
    expect(screen.queryByText("incomplete")).toBeNull();
  });

  it("shows the failure reason and its hint when the campaign failed", () => {
    render(
      <ReachFunnel
        campaign={campaign({
          status: "failed",
          failure_reason: "query_too_heavy",
        })}
      />
    );
    expect(screen.getByText("Segment too heavy")).toBeInTheDocument();
    expect(screen.getByText(/narrow the segment/i)).toBeInTheDocument();
  });

  it("does not show a failure panel for a non-failed campaign", () => {
    render(<ReachFunnel campaign={campaign()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
