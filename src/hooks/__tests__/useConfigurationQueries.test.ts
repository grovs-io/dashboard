import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";
import {
  useRedirectConfigQuery,
  useDomainConfigQuery,
  useCustomDomainQuery,
  useCustomDomainEnvelopeQuery,
  useCustomDomainsQuery,
  useCustomDomainsEnvelopeQuery,
  customDomainRefetchInterval,
} from "../queries/useConfigurationQueries";

vi.mock("@/api/configurations/redirect/configRedirectService", () => ({
  getProjectRedirectsAPICall: vi.fn(),
}));

vi.mock("@/api/configurations/domains/configDomainsService", () => ({
  getProjectDomainAPICall: vi.fn(),
  getDomainDefaultsAPICall: vi.fn(),
  getCustomDomainAPICall: vi.fn(),
  getCustomDomainsAPICall: vi.fn(),
  getCustomDomainPreflightAPICall: vi.fn(),
}));

import { getProjectRedirectsAPICall } from "@/api/configurations/redirect/configRedirectService";
import {
  getProjectDomainAPICall,
  getCustomDomainAPICall,
  getCustomDomainsAPICall,
} from "@/api/configurations/domains/configDomainsService";
import { ApiError } from "@/lib/ApiError";

const mockedGetRedirects = vi.mocked(getProjectRedirectsAPICall);
const mockedGetDomain = vi.mocked(getProjectDomainAPICall);
const mockedGetCustomDomain = vi.mocked(getCustomDomainAPICall);
const mockedGetCustomDomains = vi.mocked(getCustomDomainsAPICall);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useConfigurationQueries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  describe("useRedirectConfigQuery", () => {
    it("is disabled when projectId is undefined", () => {
      const { result } = renderHook(() => useRedirectConfigQuery(undefined), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("fetches redirect config", async () => {
      const config = { default_url: "https://example.com" };
      mockedGetRedirects.mockResolvedValueOnce({
        data: { redirect_config: config },
      } as never);

      const { result } = renderHook(() => useRedirectConfigQuery("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(config);
    });
  });

  describe("useDomainConfigQuery", () => {
    it("is disabled when projectId is undefined", () => {
      const { result } = renderHook(() => useDomainConfigQuery(undefined), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("fetches domain config", async () => {
      const domain = { subdomain: "myapp", custom_domain: null };
      mockedGetDomain.mockResolvedValueOnce({
        data: { domain },
      } as never);

      const { result } = renderHook(() => useDomainConfigQuery("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(domain);
    });
  });

  describe("customDomainRefetchInterval", () => {
    const baseDomain = {
      purpose: "primary" as const,
      ssl_status: null,
      verification_errors: null,
      source: "saas" as const,
    };

    it("polls every 30s while pending", () => {
      expect(
        customDomainRefetchInterval({
          ...baseDomain,
          hostname: "links.acme.com",
          status: "pending",
          cname_target: "x.cdn.example",
        })
      ).toBe(30000);
    });

    it("stops polling when active, failed, or null", () => {
      expect(
        customDomainRefetchInterval({
          ...baseDomain,
          hostname: "links.acme.com",
          status: "active",
          cname_target: "x.cdn.example",
        })
      ).toBe(false);
      expect(
        customDomainRefetchInterval({
          ...baseDomain,
          hostname: "links.acme.com",
          status: "failed",
          cname_target: "x.cdn.example",
        })
      ).toBe(false);
      expect(customDomainRefetchInterval(null)).toBe(false);
      expect(customDomainRefetchInterval(undefined)).toBe(false);
    });
  });

  describe("useCustomDomainQuery", () => {
    it("is disabled when projectId is undefined", () => {
      const { result } = renderHook(() => useCustomDomainQuery(undefined), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("unwraps the custom_domain object", async () => {
      const domain = {
        hostname: "links.acme.com",
        status: "pending",
        cname_target: "abc.cdn.example",
      };
      mockedGetCustomDomain.mockResolvedValueOnce({
        data: { custom_domain: domain },
      } as never);

      const { result } = renderHook(() => useCustomDomainQuery("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(domain);
    });

    it("returns null for the None state", async () => {
      mockedGetCustomDomain.mockResolvedValueOnce({
        data: { custom_domain: null },
      } as never);

      const { result } = renderHook(() => useCustomDomainQuery("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it("does not retry on a 404 from the GET", async () => {
      mockedGetCustomDomain.mockRejectedValueOnce(
        new ApiError("not found", 404)
      );

      const { result } = renderHook(() => useCustomDomainQuery("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mockedGetCustomDomain).toHaveBeenCalledTimes(1);
    });
  });

  describe("useCustomDomainEnvelopeQuery", () => {
    it("returns the full singular envelope", async () => {
      const envelope = {
        custom_domain: null,
        tls_mode: "manual",
        ingress_host: "links.app.com",
      };
      mockedGetCustomDomain.mockResolvedValueOnce({ data: envelope } as never);

      const { result } = renderHook(
        () => useCustomDomainEnvelopeQuery("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(envelope);
    });

    it("shares the request with the row-shaped hook (same query key)", async () => {
      const envelope = {
        custom_domain: {
          hostname: "links.acme.com",
          status: "pending",
          cname_target: "links.app.com",
        },
        tls_mode: "manual",
        ingress_host: "links.app.com",
      };
      mockedGetCustomDomain.mockResolvedValue({ data: envelope } as never);

      const wrapper = createWrapper(queryClient);
      const envelopeHook = renderHook(
        () => useCustomDomainEnvelopeQuery("proj-1"),
        { wrapper }
      );
      const rowHook = renderHook(() => useCustomDomainQuery("proj-1"), {
        wrapper,
      });

      await waitFor(() =>
        expect(envelopeHook.result.current.isSuccess).toBe(true)
      );
      await waitFor(() => expect(rowHook.result.current.isSuccess).toBe(true));
      expect(rowHook.result.current.data).toEqual(envelope.custom_domain);
      expect(mockedGetCustomDomain).toHaveBeenCalledTimes(1);
    });
  });

  describe("useCustomDomainsEnvelopeQuery", () => {
    it("returns the full list envelope, and the row hook the bare rows", async () => {
      const envelope = {
        custom_domains: [
          {
            hostname: "links.acme.com",
            purpose: "primary",
            status: "pending",
            cname_target: "links.app.com",
          },
        ],
        tls_mode: "manual",
        ingress_host: "links.app.com",
      };
      mockedGetCustomDomains.mockResolvedValue({ data: envelope } as never);

      const wrapper = createWrapper(queryClient);
      const envelopeHook = renderHook(
        () => useCustomDomainsEnvelopeQuery("proj-1"),
        { wrapper }
      );
      const rowsHook = renderHook(() => useCustomDomainsQuery("proj-1"), {
        wrapper,
      });

      await waitFor(() =>
        expect(envelopeHook.result.current.isSuccess).toBe(true)
      );
      await waitFor(() => expect(rowsHook.result.current.isSuccess).toBe(true));
      expect(envelopeHook.result.current.data).toEqual(envelope);
      expect(rowsHook.result.current.data).toEqual(envelope.custom_domains);
      expect(mockedGetCustomDomains).toHaveBeenCalledTimes(1);
    });
  });
});
