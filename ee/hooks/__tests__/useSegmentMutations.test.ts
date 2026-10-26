import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { AxiosHeaders } from "axios";
import { DELETE, PATCH, POST } from "@/lib/api";
import {
  useArchiveSegmentMutation,
  useCreateSegmentMutation,
  useReplaceIdentifierListMutation,
  useRequestSegmentExportMutation,
  useRestoreSegmentMutation,
  useUpdateSegmentMutation,
} from "../mutations/useSegmentMutations";

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

describe("segment mutations", () => {
  it("each write hits its endpoint; exports and list uploads invalidate narrowly", async () => {
    vi.mocked(POST).mockResolvedValue(
      ok({ segment: { id: "s1" }, export: { id: "e1" }, count: 1 })
    );
    vi.mocked(PATCH).mockResolvedValue(ok({ segment: { id: "s1" } }));
    vi.mocked(DELETE).mockResolvedValue(ok({ message: "ok" }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(
      () => ({
        create: useCreateSegmentMutation("p1"),
        update: useUpdateSegmentMutation("p1"),
        archive: useArchiveSegmentMutation("p1"),
        restore: useRestoreSegmentMutation("p1"),
        list: useReplaceIdentifierListMutation("p1"),
        exp: useRequestSegmentExportMutation("p1"),
      }),
      { wrapper }
    );
    await act(async () => {
      await result.current.create.mutateAsync({ name: "A" });
      await result.current.update.mutateAsync({
        id: "s1",
        input: { name: "B" },
      });
      await result.current.archive.mutateAsync("s1");
      await result.current.restore.mutateAsync("s1");
      await result.current.list.mutateAsync({
        id: "s1",
        payload: { identifiers: ["x"] },
      });
      await result.current.exp.mutateAsync("s1");
    });
    expect(POST).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments",
      { name: "A" },
      { maxRetries: 0 }
    );
    expect(PATCH).toHaveBeenCalledWith(
      "/api/v1/projects/p1/segments/s1",
      { name: "B" },
      { maxRetries: 0 }
    );
    expect(DELETE).toHaveBeenCalledWith("/api/v1/projects/p1/segments/s1", {
      maxRetries: 0,
    });
    expect(
      invalidate.mock.calls.filter(
        ([arg]) =>
          JSON.stringify(arg) ===
          JSON.stringify({ queryKey: ["projects", "p1"] })
      )
    ).toHaveLength(4);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "segmentExports"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "segmentCount", "s1"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "segmentMembers", "s1"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "segmentBreakdown", "s1"],
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "segmentCount", "e1"],
    });
  });
});
