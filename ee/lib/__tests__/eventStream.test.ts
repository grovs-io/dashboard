import { describe, expect, it } from "vitest";
import {
  destinationInput,
  exportInput,
  replayTimestamp,
  streamError,
} from "../eventStream";
import { destination } from "@ee/components/event-stream/__tests__/fixtures";
import { ApiError } from "@/lib/ApiError";

function form() {
  const data = new FormData();
  Object.entries({
    name: "Warehouse",
    kind: "webhook",
    url: "https://example.com/events",
    batch_size: "100",
    concurrency: "4",
    event_types: "purchase",
    credential_mode: "keep",
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}
describe("destination form contract", () => {
  it("keeps secrets unchanged during an ordinary edit", () => {
    const payload = destinationInput(form(), destination(), false);
    expect(payload).not.toHaveProperty("credentials");
    expect(payload.event_types).toEqual(["purchase"]);
  });
  it("replaces all headers explicitly and preserves their values", () => {
    const data = form();
    data.set("credential_mode", "replace");
    data.append("header_name", "Authorization");
    data.append("header_value", "Bearer replacement");
    expect(destinationInput(data, destination(), false).credentials).toEqual({
      headers: { Authorization: "Bearer replacement" },
    });
  });
  it("requires explicit confirmation to clear credentials", () => {
    const data = form();
    data.set("credential_mode", "clear");
    expect(() => destinationInput(data, destination(), false)).toThrow(
      "Confirm clearing"
    );
    data.set("confirm_clear", "on");
    expect(destinationInput(data, destination(), false).credentials).toEqual(
      {}
    );
  });
  it("does not silently clear stored headers with an empty replacement", () => {
    const data = form();
    data.set("credential_mode", "replace");
    expect(() => destinationInput(data, destination(), false)).toThrow(
      "Choose Clear credentials"
    );
  });
  it("requires both S3 keys on Cloud and allows ambient credentials on self-hosted", () => {
    const data = form();
    data.set("kind", "s3");
    data.set("bucket", "warehouse");
    data.set("region", "us-east-1");
    expect(() => destinationInput(data, undefined, false)).toThrow("both");
    expect(destinationInput(data, undefined, true).credentials).toEqual({});
    data.set("access_key_id", "id");
    data.set("secret_access_key", "secret");
    expect(destinationInput(data, undefined, false).credentials).toEqual({
      access_key_id: "id",
      secret_access_key: "secret",
    });
  });
  it("creates S3 without webhook delivery fields and ignores stale invalid inputs", () => {
    const data = form();
    data.set("kind", "s3");
    data.set("bucket", "warehouse");
    data.set("region", "us-east-1");
    data.delete("batch_size");
    data.delete("concurrency");
    expect(destinationInput(data, undefined, true)).toMatchObject({
      kind: "s3",
      batch_size: 100,
      concurrency: 4,
    });
    data.set("batch_size", "0");
    data.set("concurrency", "400");
    expect(
      destinationInput(
        data,
        destination({ kind: "s3", batch_size: 250, concurrency: 8 }),
        true
      )
    ).toMatchObject({
      batch_size: 250,
      concurrency: 8,
    });
  });
  it("rejects no event types and out-of-range delivery settings", () => {
    const data = form();
    data.delete("event_types");
    expect(() => destinationInput(data, undefined, false)).toThrow(
      "at least one"
    );
    data.set("event_types", "install");
    data.set("concurrency", "17");
    expect(() => destinationInput(data, undefined, false)).toThrow();
  });
});
describe("history bounds", () => {
  it("accepts exactly 92 inclusive days but rejects 93", () => {
    expect(exportInput("2026-01-01", "2026-04-02")).toEqual({
      start_date: "2026-01-01",
      end_date: "2026-04-02",
    });
    expect(() => exportInput("2026-01-01", "2026-04-03")).toThrow("92");
    expect(() => exportInput("2026-02-30", "2026-03-02")).toThrow("valid");
    expect(() => exportInput("2026-09-02", "2026-09-01")).toThrow(
      "on or after"
    );
  });
  it("preserves calendar dates and destination selection", () => {
    expect(exportInput("2026-09-01", "2026-09-01", "d2")).toEqual({
      start_date: "2026-09-01",
      end_date: "2026-09-01",
      destination_id: "d2",
    });
  });
  it("bounds replay to seven days and converts offsets to instants", () => {
    const now = Date.parse("2026-09-16T12:00:00Z");
    expect(replayTimestamp("2026-09-16T13:00:00+03:00", now)).toBe(
      "2026-09-16T10:00:00.000Z"
    );
    expect(() => replayTimestamp("2026-09-09T11:59:59Z", now)).toThrow(
      "seven days"
    );
    expect(() => replayTimestamp("2026-09-16T12:00:01Z", now)).toThrow(
      "future"
    );
  });
  it("distinguishes retention failures and exposes expected test refusal text", () => {
    expect(
      streamError(new ApiError("Error", 422, "retention_window_exceeded"))
    ).toContain("retained history");
    expect(
      streamError(new ApiError("Error", 502, undefined, { error: "HTTP 403" }))
    ).toBe("HTTP 403");
  });
});
