import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { AxiosHeaders } from "axios";
import { DELETE, PATCH, POST } from "@/lib/api";
import {
  useCancelPushCampaign,
  useCreatePushCampaign,
  useRemovePushImage,
  useSendPushCampaign,
  useUpdatePushCampaign,
} from "../usePushMutations";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const ok = (data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: { headers: new AxiosHeaders() },
});
const setup = () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { invalidate, wrapper };
};

afterEach(() => vi.clearAllMocks());

describe("push mutations", () => {
  it("each write hits its endpoint with maxRetries:0 and invalidates the project", async () => {
    vi.mocked(POST).mockResolvedValue(ok({ push_campaign: { id: "c1" } }));
    vi.mocked(PATCH).mockResolvedValue(ok({ push_campaign: { id: "c1" } }));
    vi.mocked(DELETE).mockResolvedValue(ok({ push_campaign: { id: "c1" } }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(
      () => ({
        create: useCreatePushCampaign("p1"),
        update: useUpdatePushCampaign("p1"),
        removeImage: useRemovePushImage("p1"),
        send: useSendPushCampaign("p1"),
        cancel: useCancelPushCampaign("p1"),
      }),
      { wrapper }
    );
    await act(async () => {
      await result.current.create.mutateAsync({ name: "A" });
      await result.current.update.mutateAsync({
        id: "c1",
        input: { name: "B" },
      });
      await result.current.removeImage.mutateAsync("c1");
      await result.current.send.mutateAsync({ id: "c1", schedule: {} });
      await result.current.cancel.mutateAsync("c1");
    });

    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns",
      { name: "A" },
      { maxRetries: 0 }
    );
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/c1",
      { name: "B" },
      { maxRetries: 0 }
    );
    expect(DELETE).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/c1/image",
      { maxRetries: 0 }
    );
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/c1/send",
      {},
      { maxRetries: 0 }
    );
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/push_campaigns/c1/cancel",
      {},
      { maxRetries: 0 }
    );

    expect(
      invalidate.mock.calls.filter(
        ([arg]) =>
          JSON.stringify(arg) ===
          JSON.stringify({ queryKey: ["projects", "p1"] })
      )
    ).toHaveLength(5);
  });
});
