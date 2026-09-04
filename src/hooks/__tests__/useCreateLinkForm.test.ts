import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCreateLinkForm } from "../useCreateLinkForm";
import type { Link } from "@/types";

describe("useCreateLinkForm", () => {
  it("prefills an existing desktop redirect URL", () => {
    const { result } = renderHook(() => useCreateLinkForm());
    const link = {
      id: "1",
      name: "Test link",
      path: "f22169",
      active: true,
      ads_platform: "quick_link",
      tags: [],
      desktop_custom_redirect: {
        url: "https://appssemble.com",
        open_app_if_installed: false,
      },
      total_views: 0,
      total_opens: 0,
      total_installs: 0,
      total_reinstalls: 0,
      total_reactivations: 0,
      total_time_spent: 0,
      total_revenue: 0,
      updated_at: "2026-07-24T00:00:00Z",
      created_at: "2026-07-24T00:00:00Z",
    } satisfies Link;

    act(() => result.current.initializeFromLink(link));

    expect(result.current.desktopRedirectType).toBe("redirect_web");
    expect(result.current.desktopRedirectURL).toEqual({
      url: "https://appssemble.com",
      open_app_if_installed: false,
    });
  });
});
