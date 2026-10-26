import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { pushApi } from "../pushCampaignsService";
import { buildPushFormData } from "@ee/lib/push";
import type { PushCampaignInput } from "@ee/types/push";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const input: PushCampaignInput = {
  name: "Spring launch",
  title: "Spring is here",
  body: "Open the app for 20% off this week",
  audience: { type: "segment", segment_id: "s9Kq1" },
};

describe("push campaigns request contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists without a status filter and never retries", async () => {
    await pushApi.list("p1");
    expect(GET).toHaveBeenCalledWith("/api/v1/projects/p1/push_campaigns", {
      maxRetries: 0,
      signal: undefined,
    });
  });

  it("lists with a status filter", async () => {
    await pushApi.list("p1", { status: "draft" });
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns?status=draft",
      { maxRetries: 0, signal: undefined }
    );
  });

  it("pages with the after cursor and a limit", async () => {
    await pushApi.list("p1", { status: "sent", after: "k9Qx2", limit: 50 });
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns?status=sent&after=k9Qx2&limit=50",
      { maxRetries: 0, signal: undefined }
    );
  });

  it("gets a single campaign on the campaign path", async () => {
    await pushApi.get("p1", "k9Qx2");
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2",
      { maxRetries: 0, signal: undefined }
    );
  });

  it("creates with a plain JSON body", async () => {
    await pushApi.create("p1", input);
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns",
      input,
      { maxRetries: 0 }
    );
  });

  it("creates with a FormData body unchanged", async () => {
    const form = new FormData();
    form.append("title", "x");
    await pushApi.create("p1", form);
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns",
      form,
      { maxRetries: 0 }
    );
  });

  it("updates on the campaign path with JSON or FormData", async () => {
    await pushApi.update("p1", "k9Qx2", { title: "New title" });
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2",
      { title: "New title" },
      { maxRetries: 0 }
    );
    const form = new FormData();
    await pushApi.update("p1", "k9Qx2", form);
    expect(PATCH).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2",
      form,
      { maxRetries: 0 }
    );
  });

  it("pins the multipart shape the controller reads (params[:image], :audience, :data)", async () => {
    const image = new File([new Uint8Array(4)], "hero.png", {
      type: "image/png",
    });
    const form = buildPushFormData(
      {
        ...input,
        link_id: 4821,
        data: { promo: "spring26" },
        audience: { type: "identifiers", recipients: ["u1", "u2"] },
      },
      image
    );
    await pushApi.create("p1", form);
    const sent = vi.mocked(POST).mock.calls[0]![1] as FormData;
    expect([...sent.keys()]).toEqual([
      "name",
      "title",
      "body",
      "link_id",
      "data[promo]",
      "audience[type]",
      "audience[recipients][]",
      "audience[recipients][]",
      "image",
    ]);
    expect(sent.get("link_id")).toBe("4821");
    expect(sent.getAll("audience[recipients][]")).toEqual(["u1", "u2"]);
    expect(sent.get("image")).toBe(image);
    expect(
      buildPushFormData({
        audience: { type: "segment", segment_id: "s9Kq1" },
      }).get("audience[segment_id]")
    ).toBe("s9Kq1");
  });

  it("removes the image on the image subpath", async () => {
    await pushApi.removeImage("p1", "k9Qx2");
    expect(DELETE).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2/image",
      { maxRetries: 0 }
    );
  });

  it("sends with the schedule body", async () => {
    await pushApi.send("p1", "k9Qx2", {
      scheduled_at: "2026-10-01T09:00:00Z",
      local_time: true,
      timezone: "Europe/Bucharest",
    });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2/send",
      {
        scheduled_at: "2026-10-01T09:00:00Z",
        local_time: true,
        timezone: "Europe/Bucharest",
      },
      { maxRetries: 0 }
    );
  });

  it("sends now with an empty schedule body", async () => {
    await pushApi.send("p1", "k9Qx2", {});
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2/send",
      {},
      { maxRetries: 0 }
    );
  });

  it("cancels with an empty body", async () => {
    await pushApi.cancel("p1", "k9Qx2");
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2/cancel",
      {},
      { maxRetries: 0 }
    );
  });

  it("estimates an audience without a draft, never retrying", async () => {
    const signal = new AbortController().signal;
    await pushApi.estimateAudience(
      "p1",
      { type: "identifiers", recipients: ["u1"] },
      signal
    );
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/estimate",
      { audience: { type: "identifiers", recipients: ["u1"] } },
      { maxRetries: 0, signal }
    );
  });

  it("lists deliveries with no params", async () => {
    await pushApi.deliveries("p1", "k9Qx2");
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2/deliveries",
      { maxRetries: 0, signal: undefined }
    );
  });

  it("lists deliveries with status, after and limit as query params", async () => {
    await pushApi.deliveries("p1", "k9Qx2", {
      status: "failed",
      after: 42,
      limit: 50,
    });
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/k9Qx2/deliveries?status=failed&after=42&limit=50",
      { maxRetries: 0, signal: undefined }
    );
  });
});
