import type { EventDestination } from "@ee/types/eventStream";
export function destination(
  overrides: Partial<EventDestination> = {}
): EventDestination {
  return {
    id: "d1",
    name: "Warehouse",
    kind: "webhook",
    status: "enabled",
    paused_reason: null,
    settings: { url: "https://example.com/events" },
    has_credentials: true,
    event_types: ["install", "purchase"],
    batch_size: 100,
    concurrency: 4,
    include_ip: false,
    lag_seconds: 15,
    delivered_count: 120,
    consecutive_failures: 0,
    last_error: null,
    last_delivered_at: "2026-09-16T08:00:00Z",
    last_attempt_at: "2026-09-16T08:00:00Z",
    failing_since: null,
    backoff_until: null,
    events_cursor_at: "2026-09-16T08:00:00Z",
    purchases_cursor_at: null,
    created_at: "2026-09-15T08:00:00Z",
    updated_at: "2026-09-16T08:00:00Z",
    ...overrides,
  };
}
