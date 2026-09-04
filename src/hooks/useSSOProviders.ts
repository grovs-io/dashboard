"use client";

import { useEffect, useState } from "react";
import {
  fetchSSOProvidersAPICall,
  SSO_PROVIDERS,
  type SSOProvider,
} from "@/api/auth/userService";
import { IS_SELF_HOSTED } from "@/lib/edition";

export function useSSOProviders(
  selfHosted: boolean = IS_SELF_HOSTED
): readonly SSOProvider[] {
  const [providers, setProviders] = useState<readonly SSOProvider[]>(
    selfHosted ? [] : SSO_PROVIDERS
  );

  useEffect(() => {
    let active = true;

    void fetchSSOProvidersAPICall()
      .then((response) => {
        if (!active) return;

        const available = response.data.providers.filter(
          (provider): provider is SSOProvider =>
            SSO_PROVIDERS.includes(provider as SSOProvider)
        );
        setProviders(available);
      })
      .catch(() => {
        // Older SaaS backends may not expose capability discovery yet, so keep
        // the existing SaaS buttons. Self-hosted mode fails closed to local
        // login rather than advertising an unverified provider.
      });

    return () => {
      active = false;
    };
  }, []);

  return providers;
}
