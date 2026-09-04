import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const userState: { user: unknown; ref: unknown } = { user: null, ref: null };
const selectionState: { id: string | undefined } = { id: "i1" };

vi.mock("@/context/useUserContext", () => ({
  useUserContext: () => ({
    user: userState.user,
    userRef: { current: userState.ref },
  }),
}));

vi.mock("@/context/useProjectSelection", () => ({
  useProjectSelection: () => ({ selectedInstance: { id: selectionState.id } }),
}));

import { useIsInstanceAdmin } from "@/hooks/useIsInstanceAdmin";

describe("useIsInstanceAdmin", () => {
  beforeEach(() => {
    userState.user = null;
    userState.ref = null;
    selectionState.id = "i1";
  });

  it("is true for an admin on the selected instance", () => {
    userState.user = { roles: [{ instance_id: "i1", role: "admin" }] };
    const { result } = renderHook(() => useIsInstanceAdmin());
    expect(result.current).toBe(true);
  });

  it("is false for a non-admin role", () => {
    userState.user = { roles: [{ instance_id: "i1", role: "member" }] };
    const { result } = renderHook(() => useIsInstanceAdmin());
    expect(result.current).toBe(false);
  });

  it("is false when admin on a different instance", () => {
    userState.user = { roles: [{ instance_id: "other", role: "admin" }] };
    const { result } = renderHook(() => useIsInstanceAdmin());
    expect(result.current).toBe(false);
  });

  // The sidebar mounts before roles land; a ref-only read never re-renders.
  it("reads reactive user state, not just the ref", () => {
    userState.user = { roles: [{ instance_id: "i1", role: "admin" }] };
    userState.ref = null;
    const { result } = renderHook(() => useIsInstanceAdmin());
    expect(result.current).toBe(true);
  });

  it("falls back to the ref before user state is set", () => {
    userState.ref = { roles: [{ instance_id: "i1", role: "admin" }] };
    const { result } = renderHook(() => useIsInstanceAdmin());
    expect(result.current).toBe(true);
  });

  it("is false with no roles at all", () => {
    const { result } = renderHook(() => useIsInstanceAdmin());
    expect(result.current).toBe(false);
  });
});
