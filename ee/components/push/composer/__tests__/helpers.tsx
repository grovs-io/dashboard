import { vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import type { PushCampaign } from "@ee/types/push";

export const ok = (data: unknown, status = 200) => ({
  data,
  status,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});

export const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {ui}
    </QueryClientProvider>
  );

// Radix Popover/RadioGroup and cmdk need these browser APIs, which jsdom lacks.
export function polyfillDom() {
  for (const method of [
    "hasPointerCapture",
    "setPointerCapture",
    "releasePointerCapture",
    "scrollIntoView",
  ]) {
    Object.defineProperty(HTMLElement.prototype, method, {
      configurable: true,
      value: vi.fn(() => false),
    });
  }
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
  );
}

export const draftCampaign = (
  over: Partial<PushCampaign> = {}
): PushCampaign => ({
  id: "k9Qx2",
  name: "Spring",
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
    recipients_count: 1,
    recipients: ["user_1"],
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
  control_group: null,
  conversion: null,
  variants: null,
  test_share: null,
  winner_after_minutes: null,
  winner_by: null,
  winner_due_at: null,
  winner: null,
  created_at: "2026-09-23T00:00:00Z",
  updated_at: "2026-09-23T00:00:00Z",
  ...over,
});
