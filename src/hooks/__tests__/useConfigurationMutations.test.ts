import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createTestQueryClient } from "./query-test-utils";
import {
  useSetDefaultRedirectMutation,
  useSetRedirectMutation,
  useSetSubdomainMutation,
  useSetGoogleTrackingIDMutation,
  useVerifySubdomainMutation,
  useAddCustomDomainMutation,
  useRemoveCustomDomainMutation,
  useVerifyCustomDomainMutation,
} from "../mutations/useConfigurationMutations";
import { queryKeys } from "@/lib/queryKeys";

vi.mock("@/api/configurations/redirect/configRedirectService", () => ({
  setDefaultRedirectAPICall: vi.fn(),
  setRedirectAPICall: vi.fn(),
}));

vi.mock("@/api/configurations/domains/configDomainsService", () => ({
  setSubdomainAPICall: vi.fn(),
  setGoogleTrackingIDAPICall: vi.fn(),
  verifySubdomainAvailabilityAPICall: vi.fn(),
  addCustomDomainWithPurposeAPICall: vi.fn(),
  removeCustomDomainByPurposeAPICall: vi.fn(),
  verifyCustomDomainAPICall: vi.fn(),
}));

vi.mock("@/analytics", () => ({
  trackEvent: vi.fn(),
  EVENTS: {
    REDIRECT_RULES_CREATED: "redirect_rules_created",
  },
}));

import {
  setDefaultRedirectAPICall,
  setRedirectAPICall,
} from "@/api/configurations/redirect/configRedirectService";

import {
  setSubdomainAPICall,
  setGoogleTrackingIDAPICall,
  verifySubdomainAvailabilityAPICall,
  addCustomDomainWithPurposeAPICall,
  removeCustomDomainByPurposeAPICall,
  verifyCustomDomainAPICall,
} from "@/api/configurations/domains/configDomainsService";
import type { GoogleTrackingIdPayload } from "@/types";

import { trackEvent } from "@/analytics";

const mockedSetDefaultRedirect = vi.mocked(setDefaultRedirectAPICall);
const mockedSetRedirect = vi.mocked(setRedirectAPICall);
const mockedSetSubdomain = vi.mocked(setSubdomainAPICall);
const mockedSetGoogleTrackingID = vi.mocked(setGoogleTrackingIDAPICall);
const mockedVerifySubdomain = vi.mocked(verifySubdomainAvailabilityAPICall);
const mockedAddCustomDomain = vi.mocked(addCustomDomainWithPurposeAPICall);
const mockedRemoveCustomDomain = vi.mocked(removeCustomDomainByPurposeAPICall);
const mockedTrackEvent = vi.mocked(trackEvent);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useConfigurationMutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  describe("useSetDefaultRedirectMutation", () => {
    it("calls setDefaultRedirectAPICall with correct arguments", async () => {
      mockedSetDefaultRedirect.mockResolvedValueOnce({ data: {} } as never);

      const { result } = renderHook(
        () => useSetDefaultRedirectMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync({
          defaultFallback: "https://example.com",
          showAndroidPreview: true,
          showIosPreview: false,
          copyToClipboardAndroid: true,
          copyToClipboardIos: false,
        });
      });

      expect(mockedSetDefaultRedirect).toHaveBeenCalledWith(
        "proj-1",
        "https://example.com",
        true,
        false,
        true,
        false
      );
    });

    it("tracks event on success without invalidating queries", async () => {
      mockedSetDefaultRedirect.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useSetDefaultRedirectMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync({
          defaultFallback: "https://example.com",
          showAndroidPreview: false,
          showIosPreview: false,
          copyToClipboardAndroid: false,
          copyToClipboardIos: false,
        });
      });

      expect(mockedTrackEvent).toHaveBeenCalledWith("redirect_rules_created", {
        projectId: "proj-1",
      });
      // Invalidation is handled by the caller (handleSaveAll) to avoid race conditions
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useSetRedirectMutation", () => {
    it("calls setRedirectAPICall with correct arguments", async () => {
      mockedSetRedirect.mockResolvedValueOnce({ data: {} } as never);

      const { result } = renderHook(() => useSetRedirectMutation("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          platform: "ios",
          variation: "phone",
          appstore: true,
          fallbackUrl: "https://fallback.com",
          enabled: true,
        });
      });

      expect(mockedSetRedirect).toHaveBeenCalledWith(
        "proj-1",
        "ios",
        "phone",
        true,
        "https://fallback.com",
        true
      );
    });

    it("does not invalidate queries (handled by caller)", async () => {
      mockedSetRedirect.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetRedirectMutation("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          platform: "android",
          variation: "phone",
          appstore: false,
          fallbackUrl: null,
          enabled: false,
        });
      });

      // Invalidation is handled by the caller (handleSaveAll) to avoid race conditions
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useSetSubdomainMutation", () => {
    it("calls setSubdomainAPICall with projectId and formData", async () => {
      mockedSetSubdomain.mockResolvedValueOnce({ data: {} } as never);

      const { result } = renderHook(() => useSetSubdomainMutation("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      const formData = { subdomain: "my-app" };
      await act(async () => {
        await result.current.mutateAsync(formData);
      });

      expect(mockedSetSubdomain).toHaveBeenCalledWith("proj-1", formData);
    });

    it("invalidates domain config on success", async () => {
      mockedSetSubdomain.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetSubdomainMutation("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ subdomain: "test" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["projects", "proj-1", "domainConfig"],
      });
    });

    it("invalidates the instances list, which is where the link dialog reads the host", async () => {
      mockedSetSubdomain.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetSubdomainMutation("proj-1"), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ subdomain: "test" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["instances"] });
    });

    it("does not invalidate when projectId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useSetSubdomainMutation(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ subdomain: "test" }).catch(() => {});
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useSetGoogleTrackingIDMutation", () => {
    it("calls setGoogleTrackingIDAPICall with projectId and formData", async () => {
      mockedSetGoogleTrackingID.mockResolvedValueOnce({ data: {} } as never);

      const { result } = renderHook(
        () => useSetGoogleTrackingIDMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      const formData = {
        tracking_id: "G-12345",
      } as unknown as GoogleTrackingIdPayload;
      await act(async () => {
        await result.current.mutateAsync(formData);
      });

      expect(mockedSetGoogleTrackingID).toHaveBeenCalledWith(
        "proj-1",
        formData
      );
    });

    it("invalidates domain config on success", async () => {
      mockedSetGoogleTrackingID.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useSetGoogleTrackingIDMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync({
          tracking_id: "G-12345",
        } as unknown as GoogleTrackingIdPayload);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["projects", "proj-1", "domainConfig"],
      });
    });

    it("does not invalidate when projectId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useSetGoogleTrackingIDMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current
          .mutateAsync({
            tracking_id: "G-12345",
          } as unknown as GoogleTrackingIdPayload)
          .catch(() => {});
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useVerifySubdomainMutation", () => {
    it("calls verifySubdomainAvailabilityAPICall with projectId and subdomain", async () => {
      mockedVerifySubdomain.mockResolvedValueOnce({
        data: { available: true },
      } as never);

      const { result } = renderHook(
        () => useVerifySubdomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync("my-subdomain");
      });

      expect(mockedVerifySubdomain).toHaveBeenCalledWith(
        "proj-1",
        "my-subdomain"
      );
    });

    it("does not invalidate any queries (no onSuccess handler)", async () => {
      mockedVerifySubdomain.mockResolvedValueOnce({
        data: { available: true },
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useVerifySubdomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync("test-sub");
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useAddCustomDomainMutation", () => {
    it("calls addCustomDomainWithPurposeAPICall with hostname and purpose", async () => {
      mockedAddCustomDomain.mockResolvedValueOnce({ data: {} } as never);
      const { result } = renderHook(
        () => useAddCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );
      await act(async () => {
        await result.current.mutateAsync({
          hostname: "links.acme.com",
          purpose: "primary",
        });
      });
      expect(mockedAddCustomDomain).toHaveBeenCalledWith(
        "proj-1",
        "links.acme.com",
        "primary"
      );
    });

    it("defaults purpose to primary when omitted", async () => {
      mockedAddCustomDomain.mockResolvedValueOnce({ data: {} } as never);
      const { result } = renderHook(
        () => useAddCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );
      await act(async () => {
        await result.current.mutateAsync({ hostname: "links.acme.com" });
      });
      expect(mockedAddCustomDomain).toHaveBeenCalledWith(
        "proj-1",
        "links.acme.com",
        "primary"
      );
    });

    it("invalidates the custom domains query on success", async () => {
      mockedAddCustomDomain.mockResolvedValueOnce({ data: {} } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(
        () => useAddCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );
      await act(async () => {
        await result.current.mutateAsync({
          hostname: "links.acme.com",
          purpose: "primary",
        });
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.projects.customDomains("proj-1"),
      });
    });

    it("does not invalidate when projectId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useAddCustomDomainMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            hostname: "links.acme.com",
            purpose: "primary",
          })
        ).rejects.toThrow("No project selected");
      });

      expect(mockedAddCustomDomain).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useRemoveCustomDomainMutation", () => {
    it("calls removeCustomDomainByPurposeAPICall and invalidates", async () => {
      mockedRemoveCustomDomain.mockResolvedValueOnce({
        status: 202,
        data: undefined,
      } as never);
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(
        () => useRemoveCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );
      await act(async () => {
        await result.current.mutateAsync("primary");
      });
      expect(mockedRemoveCustomDomain).toHaveBeenCalledWith(
        "proj-1",
        "primary"
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.projects.customDomains("proj-1"),
      });
    });

    it("defaults purpose to primary when not passed", async () => {
      mockedRemoveCustomDomain.mockResolvedValueOnce({
        status: 202,
        data: undefined,
      } as never);
      const { result } = renderHook(
        () => useRemoveCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );
      await act(async () => {
        await result.current.mutateAsync(undefined as never);
      });
      expect(mockedRemoveCustomDomain).toHaveBeenCalledWith(
        "proj-1",
        "primary"
      );
    });

    it("does not invalidate when projectId is undefined", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useRemoveCustomDomainMutation(undefined),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await expect(result.current.mutateAsync("primary")).rejects.toThrow(
          "No project selected"
        );
      });

      expect(mockedRemoveCustomDomain).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe("useVerifyCustomDomainMutation", () => {
    const mockedVerifyCustomDomain = vi.mocked(verifyCustomDomainAPICall);

    // The shared client's gcTime: 0 would GC the observer-less cache entries.
    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
    });

    const verifiedPrimaryEnvelope = {
      custom_domain: {
        hostname: "links.acme.com",
        purpose: "primary",
        status: "active",
        ssl_status: null,
        verification_errors: null,
        source: "enterprise",
        cname_target: "links.app.com",
      },
      tls_mode: "manual",
      ingress_host: "links.app.com",
    };

    it("calls verifyCustomDomainAPICall with projectId and hostname", async () => {
      mockedVerifyCustomDomain.mockResolvedValueOnce({
        data: verifiedPrimaryEnvelope,
      } as never);

      const { result } = renderHook(
        () => useVerifyCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync("links.acme.com");
      });

      expect(mockedVerifyCustomDomain).toHaveBeenCalledWith(
        "proj-1",
        "links.acme.com"
      );
    });

    it("writes the post-probe row into the plural list cache in place", async () => {
      queryClient.setQueryData(queryKeys.projects.customDomains("proj-1"), {
        custom_domains: [
          { ...verifiedPrimaryEnvelope.custom_domain, status: "pending" },
          { hostname: "old.acme.com", purpose: "migration", status: "pending" },
        ],
        tls_mode: "manual",
        ingress_host: "links.app.com",
      });
      mockedVerifyCustomDomain.mockResolvedValueOnce({
        data: verifiedPrimaryEnvelope,
      } as never);

      const { result } = renderHook(
        () => useVerifyCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync("links.acme.com");
      });

      const list = queryClient.getQueryData(
        queryKeys.projects.customDomains("proj-1")
      ) as { custom_domains: Array<{ hostname: string; status: string }> };
      expect(
        list.custom_domains.find((d) => d.hostname === "links.acme.com")?.status
      ).toBe("active");
      expect(
        list.custom_domains.find((d) => d.hostname === "old.acme.com")?.status
      ).toBe("pending");
    });

    it("updates the singular cache for a primary row", async () => {
      mockedVerifyCustomDomain.mockResolvedValueOnce({
        data: verifiedPrimaryEnvelope,
      } as never);

      const { result } = renderHook(
        () => useVerifyCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync("links.acme.com");
      });

      expect(
        queryClient.getQueryData(queryKeys.projects.customDomain("proj-1"))
      ).toEqual(verifiedPrimaryEnvelope);
    });

    it("preserves cached tls_mode and ingress_host when the response omits them", async () => {
      queryClient.setQueryData(queryKeys.projects.customDomains("proj-1"), {
        custom_domains: [
          { ...verifiedPrimaryEnvelope.custom_domain, status: "pending" },
        ],
        tls_mode: "manual",
        ingress_host: "links.app.com",
      });
      queryClient.setQueryData(queryKeys.projects.customDomain("proj-1"), {
        custom_domain: {
          ...verifiedPrimaryEnvelope.custom_domain,
          status: "pending",
        },
        tls_mode: "manual",
        ingress_host: "links.app.com",
      });
      mockedVerifyCustomDomain.mockResolvedValueOnce({
        data: { custom_domain: verifiedPrimaryEnvelope.custom_domain },
      } as never);

      const { result } = renderHook(
        () => useVerifyCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync("links.acme.com");
      });

      const list = queryClient.getQueryData(
        queryKeys.projects.customDomains("proj-1")
      ) as { tls_mode?: string; ingress_host?: string | null };
      expect(list.tls_mode).toBe("manual");
      expect(list.ingress_host).toBe("links.app.com");
      const singular = queryClient.getQueryData(
        queryKeys.projects.customDomain("proj-1")
      ) as { tls_mode?: string; custom_domain: { status: string } };
      expect(singular.tls_mode).toBe("manual");
      expect(singular.custom_domain.status).toBe("active");
    });

    it("leaves the singular (primary) cache alone for a migration row", async () => {
      const primaryEnvelope = {
        custom_domain: verifiedPrimaryEnvelope.custom_domain,
        tls_mode: "manual",
        ingress_host: "links.app.com",
      };
      queryClient.setQueryData(
        queryKeys.projects.customDomain("proj-1"),
        primaryEnvelope
      );
      mockedVerifyCustomDomain.mockResolvedValueOnce({
        data: {
          ...verifiedPrimaryEnvelope,
          custom_domain: {
            ...verifiedPrimaryEnvelope.custom_domain,
            hostname: "old.acme.com",
            purpose: "migration",
          },
        },
      } as never);

      const { result } = renderHook(
        () => useVerifyCustomDomainMutation("proj-1"),
        { wrapper: createWrapper(queryClient) }
      );

      await act(async () => {
        await result.current.mutateAsync("old.acme.com");
      });

      expect(
        queryClient.getQueryData(queryKeys.projects.customDomain("proj-1"))
      ).toEqual(primaryEnvelope);
    });
  });
});
