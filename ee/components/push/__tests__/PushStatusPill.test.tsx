import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PushStatusPill from "../PushStatusPill";
import type { PushStatus } from "@ee/types/push";

const ALL_STATUSES: PushStatus[] = [
  "draft",
  "scheduled",
  "evaluating",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

describe("PushStatusPill", () => {
  it("renders the label for every status", () => {
    for (const status of ALL_STATUSES) {
      const { unmount } = render(<PushStatusPill status={status} />);
      expect(screen.getByText(new RegExp(status, "i"))).toBeInTheDocument();
      unmount();
    }
  });

  it("reads Waiting for the winner, in blue, while the rest wait", () => {
    render(<PushStatusPill status="sent" waiting />);
    expect(screen.getByText("Waiting for the winner")).toBeInTheDocument();
    expect(screen.queryByText("Sent")).toBeNull();
  });

  it("shows a spinner only while evaluating or sending", () => {
    const { container: evaluating } = render(
      <PushStatusPill status="evaluating" />
    );
    expect(evaluating.querySelector(".animate-spin")).toBeInTheDocument();

    const { container: sending } = render(<PushStatusPill status="sending" />);
    expect(sending.querySelector(".animate-spin")).toBeInTheDocument();

    const { container: sent } = render(<PushStatusPill status="sent" />);
    expect(sent.querySelector(".animate-spin")).toBeNull();

    const { container: draft } = render(<PushStatusPill status="draft" />);
    expect(draft.querySelector(".animate-spin")).toBeNull();
  });
});
