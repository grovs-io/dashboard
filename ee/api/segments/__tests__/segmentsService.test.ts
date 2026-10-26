import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/lib/api";
import { segmentsApi } from "../segmentsService";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const definition = { version: 1 as const, operator: "or" as const, groups: [] };

describe("segments request contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists with the archived flag and never retries", async () => {
    await segmentsApi.list("p1", true);
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments?archived=true",
      {
        maxRetries: 0,
        signal: undefined,
      }
    );
  });

  it("creates, updates, archives and restores on the segment paths", async () => {
    await segmentsApi.create("p1", { name: "A", definition });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments",
      { name: "A", definition },
      { maxRetries: 0 }
    );
    await segmentsApi.update("p1", "s 1", { name: "B" });
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s%201",
      { name: "B" },
      { maxRetries: 0 }
    );
    await segmentsApi.archive("p1", "s1");
    expect(DELETE).toHaveBeenCalledWith("/api/v1/projects/p1/segments/s1", {
      maxRetries: 0,
    });
    await segmentsApi.restore("p1", "s1");
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1",
      { archived: false },
      { maxRetries: 0 }
    );
  });

  it("evaluates through estimate, count, users and breakdown without retries", async () => {
    await segmentsApi.estimate("p1", { definition });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/estimate",
      { definition },
      { maxRetries: 0, signal: undefined }
    );
    await segmentsApi.count("p1", "s1");
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/count",
      {},
      { maxRetries: 0 }
    );
    await segmentsApi.users("p1", "s1", { cursor: "c", limit: 50 });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/users",
      { cursor: "c", limit: 50 },
      { maxRetries: 0 }
    );
    await segmentsApi.breakdown("p1", "s1", { by: "platform", result_id: "r" });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/breakdown",
      { by: "platform", result_id: "r" },
      { maxRetries: 0 }
    );
  });

  it("uploads an identifier list as JSON or multipart", async () => {
    await segmentsApi.replaceIdentifierList("p1", "s1", { identifiers: ["a"] });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/identifier_list",
      { identifiers: ["a"] },
      { maxRetries: 0 }
    );
    const form = new FormData();
    await segmentsApi.replaceIdentifierList("p1", "s1", form);
    expect(POST).toHaveBeenLastCalledWith(
      "/api/v1/projects/p1/segments/s1/identifier_list",
      form,
      { maxRetries: 0 }
    );
  });

  it("reads the catalogue, size history and exports", async () => {
    await segmentsApi.fields("p1");
    expect(GET).toHaveBeenCalledWith("/api/v1/projects/p1/segments/fields", {
      maxRetries: 0,
      signal: undefined,
    });
    await segmentsApi.sizeHistory("p1", "s1");
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/size_history",
      { maxRetries: 0 }
    );
    await segmentsApi.requestExport("p1", "s1");
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1/export",
      {},
      { maxRetries: 0 }
    );
    await segmentsApi.exports("p1");
    expect(GET).toHaveBeenCalledWith("/api/v1/projects/p1/segment_exports", {
      maxRetries: 0,
      signal: undefined,
    });
    await segmentsApi.exportStatus("p1", "e1");
    expect(GET).toHaveBeenCalledWith("/api/v1/projects/p1/segment_exports/e1", {
      maxRetries: 0,
    });
  });
});
