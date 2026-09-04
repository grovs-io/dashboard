import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/lib/api";
import { fetchSSOProvidersAPICall } from "../userService";

vi.mock("@/lib/api", () => ({
  DELETE: vi.fn(),
  GET: vi.fn(),
  PATCH: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: {
    apiPath: "/api/v1",
  },
}));

describe("fetchSSOProvidersAPICall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the public SSO capability endpoint", async () => {
    const response = {
      data: {
        sso_enabled: true,
        providers: ["microsoft_graph"],
      },
    };
    vi.mocked(GET).mockResolvedValueOnce(response as never);

    await expect(fetchSSOProvidersAPICall()).resolves.toBe(response);
    expect(GET).toHaveBeenCalledWith("/api/v1/identity/sso/providers");
  });
});
