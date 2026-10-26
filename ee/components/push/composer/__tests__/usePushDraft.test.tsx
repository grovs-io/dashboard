import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PATCH } from "@/lib/api";
import { ApiError } from "@/lib/ApiError";
import { usePushDraft } from "../usePushDraft";
import { draftCampaign, ok } from "./helpers";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => vi.clearAllMocks());

describe("usePushDraft", () => {
  it("keeps a saved text change when the image upload after it fails, and retries only the image", async () => {
    const initial = draftCampaign();
    const saved = { ...initial, title: "New title" };
    vi.mocked(PATCH).mockImplementation(async (_path, body) => {
      if (body instanceof FormData)
        throw new ApiError("Image must be a PNG or JPEG", 422);
      return ok({ push_campaign: saved });
    });
    const baseline = { title: initial.title };
    const { result } = renderHook(() => usePushDraft("p1", initial, baseline), {
      wrapper,
    });
    const image = new File([new Uint8Array(4)], "hero.png", {
      type: "image/png",
    });
    const input = { title: "New title" };

    await act(async () => {
      await expect(result.current.save(input, image)).rejects.toThrow(
        "Image must be a PNG or JPEG"
      );
    });
    expect(result.current.campaign?.title).toBe("New title");
    expect(result.current.isDirty(input, null)).toBe(false);
    expect(result.current.isDirty(input, image)).toBe(true);

    vi.mocked(PATCH).mockClear();
    vi.mocked(PATCH).mockResolvedValue(ok({ push_campaign: saved }));
    await act(async () => {
      await result.current.save(input, image);
    });
    expect(PATCH).toHaveBeenCalledTimes(1);
    const body = vi.mocked(PATCH).mock.calls[0]![1] as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect([...body.keys()]).toEqual(["image"]);
    await waitFor(() =>
      expect(result.current.isDirty(input, image)).toBe(false)
    );
  });
});
