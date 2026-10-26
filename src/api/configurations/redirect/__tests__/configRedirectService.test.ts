import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  PUT: vi.fn().mockResolvedValue({ data: {} }),
}));

vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

import { PUT } from "@/lib/api";
import { setDefaultRedirectAPICall } from "@/api/configurations/redirect/configRedirectService";

describe("setDefaultRedirectAPICall", () => {
  it("sends the in-app browser flags in the PUT body", async () => {
    await setDefaultRedirectAPICall(
      "proj-1",
      "https://example.com",
      false,
      false,
      false,
      false,
      true,
      false
    );
    const body = vi.mocked(PUT).mock.calls[0]![1];
    expect(body).toMatchObject({
      in_app_browser_page_android: true,
      in_app_browser_page_ios: false,
    });
  });
});
