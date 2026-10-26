import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { defaultSchedule } from "@ee/lib/pushComposer";
import type { PushEstimate } from "@ee/types/push";
import SendConfirmDialog from "../SendConfirmDialog";

const reachRow = (reach: PushEstimate) => {
  render(
    <SendConfirmDialog
      open
      onOpenChange={vi.fn()}
      title="Autumn sale"
      audience="Segment: Buyers"
      reach={reach}
      schedule={defaultSchedule()}
      pending={false}
      onConfirm={vi.fn()}
    />
  );
  return screen.getByText("Reach").nextElementSibling!;
};

const base = {
  no_channel: 0,
  not_found: 0,
  platforms: {
    ios: { devices: null, configured: true },
    android: { devices: null, configured: true },
  },
};

describe("SendConfirmDialog reach", () => {
  it("shows the reachable count", () => {
    expect(
      reachRow({ ...base, devices: 5, reachable: 3, no_app: 2 })
    ).toHaveTextContent("3 devices");
  });

  it("falls back to all devices when the segment has no platform split", () => {
    expect(
      reachRow({ ...base, devices: 50000, reachable: null, no_app: null })
    ).toHaveTextContent("50,000 devices");
  });
});
