import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";
import { useAndroidSdkReleaseQuery } from "../queries/useAndroidSdkReleaseQuery";

const renderRelease = () => {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useAndroidSdkReleaseQuery(), { wrapper });
};

describe("useAndroidSdkReleaseQuery", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns the latest release tag", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tag_name: "1.2.3" }),
    });
    const { result } = renderRelease();
    await waitFor(() => expect(result.current.data).toBe("1.2.3"));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/grovs-io/grovs-Android/releases/latest"
    );
  });

  it("returns null on a non-OK response", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { result } = renderRelease();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("fails once without retrying when the request is blocked", async () => {
    fetchMock.mockRejectedValue(new TypeError("blocked"));
    const { result } = renderRelease();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
