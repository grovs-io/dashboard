import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/lib/api";
import { lookupLinksAPICall } from "../linksService";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

describe("lookupLinksAPICall", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs the lookup path with term and limit, and no date window", async () => {
    await lookupLinksAPICall("p1", { term: "spring sale", limit: 20 });
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/links/lookup?term=spring+sale&limit=20",
      { signal: undefined }
    );
  });

  it("omits an empty term and passes the abort signal", async () => {
    const signal = new AbortController().signal;
    await lookupLinksAPICall("p1", { limit: 20 }, signal);
    expect(GET).toHaveBeenCalledWith(
      "/api/v1/projects/p1/links/lookup?limit=20",
      {
        signal,
      }
    );
    await lookupLinksAPICall("p1");
    expect(GET).toHaveBeenLastCalledWith("/api/v1/projects/p1/links/lookup", {
      signal: undefined,
    });
  });
});
