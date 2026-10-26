import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { instance } from "./fixtures";

type Q = { data?: unknown; isLoading: boolean; isError: boolean };
const done = (data?: unknown): Q => ({
  data,
  isLoading: false,
  isError: false,
});
const pending: Q = { isLoading: true, isError: false };

const q = vi.hoisted(() => ({
  status: {} as Record<string, Q>,
  customDomains: {} as Q,
  progress: {} as Record<string, Q>,
}));

vi.mock("@/hooks/queries/useSdkStatusQuery", () => ({
  useSdkStatusQuery: (id: string) => q.status[id],
}));
vi.mock("@/hooks/queries/useInstanceQueries", () => ({
  useInstanceDetailsQuery: () => done({}),
  useInstanceConfigQuery: () => done([]),
  useSetupProgressQuery: (_id: string, category: string) =>
    q.progress[category] ?? done({ steps: [] }),
}));
vi.mock("@/hooks/queries/useConfigurationQueries", () => ({
  useCustomDomainsQuery: () => q.customDomains,
  useRedirectConfigQuery: () => done({}),
}));
vi.mock("@/hooks/queries/usePaymentsQueries", () => ({
  useSubscriptionQuery: () => done({}),
}));

import { useSetupData } from "../useSetupData";

const loading = () =>
  renderHook(() => useSetupData(instance)).result.current.loading;

beforeEach(() => {
  q.status = { p1: done({}), t1: done({}) };
  q.customDomains = done([]);
  q.progress = {};
});

describe("useSetupData loading", () => {
  it("is done once every query settled", () => {
    expect(loading()).toBe(false);
  });

  it("waits for the test project's SDK status", () => {
    q.status.t1 = pending;
    expect(loading()).toBe(true);
  });

  it("does not wait on a failed test SDK status", () => {
    q.status.t1 = { isLoading: true, isError: true };
    expect(loading()).toBe(false);
  });

  it("waits for custom domains", () => {
    q.customDomains = pending;
    expect(loading()).toBe(true);
  });
});

describe("useSetupData signals", () => {
  it("marks the app from a recorded onboarding app_connected step", () => {
    const signals = () =>
      renderHook(() => useSetupData(instance)).result.current.signals;
    expect(signals().appMarked).toBe(false);
    q.progress.onboarding = done({
      steps: [{ step_identifier: "app_connected" }],
    });
    expect(signals()).toMatchObject({ appMarked: true, appConnected: false });
  });
});
