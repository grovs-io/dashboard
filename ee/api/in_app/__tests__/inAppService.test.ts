import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { inAppApi } from "../inAppService";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const once = { maxRetries: 0 };
const read = { maxRetries: 0, signal: undefined };
const base = "/api/v1/projects/p1/in_app_campaigns";

describe("in-app request contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists, with and without filters", async () => {
    await inAppApi.list("p1");
    expect(GET).toHaveBeenCalledWith(base, read);
    await inAppApi.list("p1", { status: "live", after: "abc", limit: 20 });
    expect(GET).toHaveBeenLastCalledWith(
      `${base}?status=live&after=abc&limit=20`,
      read
    );
  });

  it("reads, creates, updates and deletes one campaign", async () => {
    await inAppApi.get("p1", "c1");
    expect(GET).toHaveBeenCalledWith(`${base}/c1`, read);
    await inAppApi.create("p1", { name: "A" });
    expect(POST).toHaveBeenCalledWith(base, { name: "A" }, once);
    await inAppApi.update("p1", "c1", { priority: 3 });
    expect(PATCH).toHaveBeenCalledWith(`${base}/c1`, { priority: 3 }, once);
    await inAppApi.remove("p1", "c1");
    expect(DELETE).toHaveBeenCalledWith(`${base}/c1`, once);
  });

  it.each(["launch", "pause", "resume", "end"] as const)(
    "%s is a post that is never repeated",
    async (step) => {
      await inAppApi.step("p1", "c1", step);
      expect(POST).toHaveBeenCalledWith(`${base}/c1/${step}`, {}, once);
    }
  );

  it("duplicates", async () => {
    await inAppApi.duplicate("p1", "c1");
    expect(POST).toHaveBeenCalledWith(`${base}/c1/duplicate`, {}, once);
  });

  it("uploads an image as a form and removes one by its slot", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    await inAppApi.uploadImage("p1", "c1", "portrait", file);
    const [url, body, options] = vi.mocked(POST).mock.calls[0]!;
    expect(url).toBe(`${base}/c1/images/portrait`);
    expect((body as FormData).get("image")).toBe(file);
    expect(options).toEqual(once);
    await inAppApi.removeImage("p1", "c1", "landscape");
    expect(DELETE).toHaveBeenCalledWith(`${base}/c1/images/landscape`, once);
  });

  it("lists, uploads and deletes a campaign's media", async () => {
    await inAppApi.media("p1", "c1");
    expect(GET).toHaveBeenCalledWith(`${base}/c1/media`, read);
    const file = new File(["x"], "a.mp4", { type: "video/mp4" });
    await inAppApi.uploadMedia("p1", "c1", file, 4);
    const [url, body, options] = vi.mocked(POST).mock.calls[0]!;
    expect(url).toBe(`${base}/c1/media`);
    expect((body as FormData).get("file")).toBe(file);
    expect((body as FormData).get("lock_version")).toBe("4");
    expect(options).toEqual(once);
    await inAppApi.removeMedia("p1", "c1", "m 1", 5);
    expect(DELETE).toHaveBeenCalledWith(
      `${base}/c1/media/m%201?lock_version=5`,
      once
    );
  });

  it("asks for a report by range", async () => {
    await inAppApi.report("p1", "c1", {
      from: "2026-09-01",
      to: "2026-09-30",
      by: "day",
    });
    expect(GET).toHaveBeenCalledWith(
      `${base}/c1/report?from=2026-09-01&to=2026-09-30&by=day`,
      read
    );
  });

  it("reads and changes the settings", async () => {
    await inAppApi.settings("p1");
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/in_app_settings",
      read
    );
    await inAppApi.updateSettings("p1", { day_cap: 3 });
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/in_app_settings",
      { day_cap: 3 },
      once
    );
  });

  it("escapes ids in the path", async () => {
    await inAppApi.get("p/1", "c 1");
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p%2F1/in_app_campaigns/c%201",
      read
    );
  });
});
