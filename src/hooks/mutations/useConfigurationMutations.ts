import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { trackEvent, EVENTS } from "@/analytics";
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
import type {
  SubdomainPayload,
  GoogleTrackingIdPayload,
  CustomDomainPurpose,
  CustomDomainResponse,
  CustomDomainsListResponse,
} from "@/types";

export function useSetDefaultRedirectMutation(projectId: string | undefined) {
  return useMutation({
    mutationFn: ({
      defaultFallback,
      showAndroidPreview,
      showIosPreview,
      copyToClipboardAndroid,
      copyToClipboardIos,
    }: {
      defaultFallback: string;
      showAndroidPreview: boolean;
      showIosPreview: boolean;
      copyToClipboardAndroid: boolean;
      copyToClipboardIos: boolean;
    }) => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return setDefaultRedirectAPICall(
        projectId,
        defaultFallback,
        showAndroidPreview,
        showIosPreview,
        copyToClipboardAndroid,
        copyToClipboardIos
      );
    },
    onSuccess: () => {
      trackEvent(EVENTS.REDIRECT_RULES_CREATED, { projectId });
    },
  });
}

export function useSetRedirectMutation(projectId: string | undefined) {
  return useMutation({
    mutationFn: ({
      platform,
      variation,
      appstore,
      fallbackUrl,
      enabled,
    }: {
      platform: string;
      variation: string;
      appstore: boolean;
      fallbackUrl: string | null;
      enabled: boolean;
    }) => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return setRedirectAPICall(
        projectId,
        platform,
        variation,
        appstore,
        fallbackUrl,
        enabled
      );
    },
  });
}

export function useSetSubdomainMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData | SubdomainPayload) => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return setSubdomainAPICall(projectId, formData);
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.domainConfig(projectId),
        });
        // The link dialog reads the host off the cached instances list, not the domain config.
        queryClient.invalidateQueries({ queryKey: queryKeys.instances.all });
      }
    },
  });
}

export function useSetGoogleTrackingIDMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData | GoogleTrackingIdPayload) => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return setGoogleTrackingIDAPICall(projectId, formData);
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.domainConfig(projectId),
        });
      }
    },
  });
}

export function useVerifySubdomainMutation(projectId: string | undefined) {
  return useMutation({
    mutationFn: (subdomain: string) => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return verifySubdomainAvailabilityAPICall(projectId, subdomain);
    },
  });
}

export function useAddCustomDomainMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { hostname: string; purpose?: CustomDomainPurpose }) => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return addCustomDomainWithPurposeAPICall(
        projectId,
        args.hostname,
        args.purpose ?? "primary"
      );
    },
    onSuccess: () => {
      if (projectId) {
        // Invalidate both keys: the plural list is the source of truth, and
        // the singular shim still backs the existing dialog read path.
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.customDomains(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.customDomain(projectId),
        });
        // The link dialog reads the host off the cached instances list, not the domain config.
        queryClient.invalidateQueries({ queryKey: queryKeys.instances.all });
      }
    },
  });
}

// Writes the post-probe row into both domain caches for instant feedback;
// deliberately no project-prefix invalidate — the response already is the fresh state.
export function useVerifyCustomDomainMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (hostname: string) => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return verifyCustomDomainAPICall(projectId, hostname);
    },
    onSuccess: (response) => {
      if (!projectId) return;
      const envelope = response.data;
      const row = envelope.custom_domain;
      if (!row) return;

      queryClient.setQueryData<CustomDomainsListResponse>(
        queryKeys.projects.customDomains(projectId),
        (current) => {
          const rows = current?.custom_domains ?? [];
          const replaced = rows.some((d) => d.hostname === row.hostname)
            ? rows.map((d) => (d.hostname === row.hostname ? row : d))
            : [...rows, row];
          return {
            ...current,
            custom_domains: replaced,
            tls_mode: envelope.tls_mode ?? current?.tls_mode,
            ingress_host: envelope.ingress_host ?? current?.ingress_host,
          };
        }
      );

      // The singular cache is the primary-purpose shim.
      if (row.purpose === "primary") {
        queryClient.setQueryData<CustomDomainResponse>(
          queryKeys.projects.customDomain(projectId),
          (current) => ({
            ...current,
            custom_domain: row,
            tls_mode: envelope.tls_mode ?? current?.tls_mode,
            ingress_host: envelope.ingress_host ?? current?.ingress_host,
          })
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.instances.all });
    },
  });
}

export function useRemoveCustomDomainMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (purpose: CustomDomainPurpose = "primary") => {
      if (!projectId) return Promise.reject(new Error("No project selected"));
      return removeCustomDomainByPurposeAPICall(projectId, purpose);
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.customDomains(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.customDomain(projectId),
        });
        // The link dialog reads the host off the cached instances list, not the domain config.
        queryClient.invalidateQueries({ queryKey: queryKeys.instances.all });
      }
    },
  });
}
