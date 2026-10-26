import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { AxiosHeaders } from "axios";
import { POST } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useJourneyImage } from "../useJourneyMutations";

vi.mock("@/lib/api", () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: { apiPath: "/api/v1" } }));

const ok = (data: unknown) => ({
  data,
  status: 201,
  statusText: "Created",
  headers: {},
  config: { headers: new AxiosHeaders() },
});

afterEach(() => vi.clearAllMocks());

describe("useJourneyImage", () => {
  it("writes the bumped lock_version into the cached journey", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({ url: "https://x/i.png", lock_version: 4 })
    );
    const client = new QueryClient();
    const key = queryKeys.projects.journey("p1", "j1");
    client.setQueryData(key, { id: "j1", name: "J", lock_version: 3 });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useJourneyImage("p1", "j1"), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        file: new File(["x"], "i.png"),
        lockVersion: 3,
      });
    });
    expect(client.getQueryData(key)).toEqual({
      id: "j1",
      name: "J",
      lock_version: 4,
    });
  });
});
