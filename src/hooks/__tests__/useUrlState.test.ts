import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Writes go through history.replaceState, so assert the resulting URL, not a router call.
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

import { useUrlState } from "../useUrlState";

const currentUrl = () => window.location.pathname + window.location.search;

// Point both the mocked useSearchParams and the real URL at the same query string.
const setUrl = (qs: string) => {
  mockSearchParams = new URLSearchParams(qs);
  window.history.replaceState(null, "", qs ? `/test-path?${qs}` : "/test-path");
};

describe("useUrlState", () => {
  beforeEach(() => {
    setUrl("");
  });

  describe("string mode (no parse/serialize options)", () => {
    it("returns default value when key is not in URL", () => {
      const { result } = renderHook(() => useUrlState("tab", "overview"));

      expect(result.current[0]).toBe("overview");
    });

    it("returns URL value when key exists in URL", () => {
      setUrl("tab=settings");
      const { result } = renderHook(() => useUrlState("tab", "overview"));

      expect(result.current[0]).toBe("settings");
    });

    it("sets value in URL", () => {
      const { result } = renderHook(() => useUrlState("tab", "overview"));

      act(() => {
        result.current[1]("settings");
      });

      expect(currentUrl()).toBe("/test-path?tab=settings");
    });

    it("removes param when setting value equal to default", () => {
      setUrl("tab=settings");
      const { result } = renderHook(() => useUrlState("tab", "overview"));

      act(() => {
        result.current[1]("overview");
      });

      expect(currentUrl()).toBe("/test-path");
    });

    it("removes param when setting empty string", () => {
      setUrl("tab=settings");
      const { result } = renderHook(() => useUrlState("tab", "overview"));

      act(() => {
        result.current[1]("");
      });

      expect(currentUrl()).toBe("/test-path");
    });

    it("preserves other existing URL params", () => {
      setUrl("page=2&tab=overview");
      const { result } = renderHook(() => useUrlState("tab", "overview"));

      act(() => {
        result.current[1]("settings");
      });

      expect(currentUrl()).toContain("page=2");
      expect(currentUrl()).toContain("tab=settings");
    });
  });

  describe("with parse option", () => {
    it("parses URL value using parse function", () => {
      setUrl("count=42");
      const { result } = renderHook(() =>
        useUrlState("count", 0, { parse: (v) => parseInt(v, 10) })
      );

      expect(result.current[0]).toBe(42);
    });

    it("returns default value when key is not in URL", () => {
      const { result } = renderHook(() =>
        useUrlState("count", 10, { parse: (v) => parseInt(v, 10) })
      );

      expect(result.current[0]).toBe(10);
    });
  });

  describe("with serialize option", () => {
    it("uses serialize function when setting value", () => {
      const { result } = renderHook(() =>
        useUrlState("count", 0, {
          parse: (v) => parseInt(v, 10),
          serialize: (v) => String(v),
        })
      );

      act(() => {
        result.current[1](42);
      });

      expect(currentUrl()).toBe("/test-path?count=42");
    });

    it("removes param when serialized value equals serialized default", () => {
      const { result } = renderHook(() =>
        useUrlState("count", 0, {
          parse: (v) => parseInt(v, 10),
          serialize: (v) => String(v),
        })
      );

      act(() => {
        result.current[1](0);
      });

      expect(currentUrl()).toBe("/test-path");
    });
  });

  describe("with boolean state", () => {
    it("parses boolean from URL", () => {
      setUrl("active=true");
      const { result } = renderHook(() =>
        useUrlState("active", false, {
          parse: (v) => v === "true",
          serialize: (v) => String(v),
        })
      );

      expect(result.current[0]).toBe(true);
    });

    it("sets boolean value in URL", () => {
      const { result } = renderHook(() =>
        useUrlState("active", false, {
          parse: (v) => v === "true",
          serialize: (v) => String(v),
        })
      );

      act(() => {
        result.current[1](true);
      });

      expect(currentUrl()).toBe("/test-path?active=true");
    });
  });

  describe("multiple keys do not interfere", () => {
    it("handles two different URL state keys independently", () => {
      setUrl("tab=settings&view=grid");

      const { result: tabResult } = renderHook(() =>
        useUrlState("tab", "overview")
      );
      const { result: viewResult } = renderHook(() =>
        useUrlState("view", "list")
      );

      expect(tabResult.current[0]).toBe("settings");
      expect(viewResult.current[0]).toBe("grid");
    });
  });
});
