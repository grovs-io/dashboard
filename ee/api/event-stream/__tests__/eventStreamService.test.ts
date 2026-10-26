import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { eventStreamApi } from "../eventStreamService";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

describe("event stream request contract", () => {
  beforeEach(() => vi.clearAllMocks());
  it("deletes only the selected project's destination without transient retries", async () => {
    await eventStreamApi.removeDestination("project-a", "destination-b");
    expect(DELETE).toHaveBeenCalledWith(
      "/api/v1/projects/project-a/event_destinations/destination-b",
      { maxRetries: 0 }
    );
  });
  it("preserves the supplied edit payload without inventing credentials", async () => {
    const input = {
      name: "Renamed",
      settings: { url: "https://example.com/hook" },
      event_types: ["purchase" as const],
      batch_size: 100,
      concurrency: 4,
      include_ip: false,
    };
    await eventStreamApi.updateDestination("p1", "d1", input);
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_destinations/d1",
      input,
      { maxRetries: 0 }
    );
    expect(input).not.toHaveProperty("credentials");
  });
  it("sends a rewind timestamp and uses the export endpoint", async () => {
    await eventStreamApi.action("p1", "d1", "rewind", "2026-09-16T08:00:00Z");
    expect(POST).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/event_destinations/d1/rewind",
      { to: "2026-09-16T08:00:00Z" },
      { maxRetries: 0 }
    );
    await eventStreamApi.export("p1", {
      start_date: "2026-09-01",
      end_date: "2026-09-10",
    });
    expect(POST).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/event_exports",
      { start_date: "2026-09-01", end_date: "2026-09-10" },
      { maxRetries: 0 }
    );
  });
  it("passes cancellation to project reads and revokes a single token", async () => {
    const controller = new AbortController();
    await eventStreamApi.destinations("p1", controller.signal);
    expect(GET).toHaveBeenCalledWith("/api/v1/projects/p1/event_destinations", {
      signal: controller.signal,
      maxRetries: 0,
    });
    await eventStreamApi.revokeToken("p1", "t1");
    expect(DELETE).toHaveBeenCalledWith(
      "/api/v1/projects/p1/event_stream_tokens/t1",
      { maxRetries: 0 }
    );
  });
});
