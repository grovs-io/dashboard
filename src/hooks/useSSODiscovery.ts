"use client";

import { useEffect, useState } from "react";
import { discoverSsoAPICall } from "@/api/sso/ssoService";

export interface SsoDiscovery {
  connectionId: number | null;
  enforce: boolean;
}

export const NO_SSO: SsoDiscovery = { connectionId: null, enforce: false };
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

// Asks the backend whether the typed email belongs to an enterprise SSO domain; failures mean "no".
export function useSSODiscovery(email: string, delayMs = 400): SsoDiscovery {
  const candidate = email.trim();
  // Keyed on the email so a stale answer never applies to a different address.
  const [answer, setAnswer] = useState<{
    email: string;
    result: SsoDiscovery;
  } | null>(null);

  useEffect(() => {
    if (!EMAIL_SHAPE.test(candidate)) return;

    let active = true;
    const timer = setTimeout(() => {
      void discoverSsoAPICall(candidate)
        .then((response) => {
          if (!active) return;
          setAnswer({
            email: candidate,
            result: {
              connectionId: response.data.connection_id,
              enforce: response.data.enforce === true,
            },
          });
        })
        .catch(() => {
          if (active) setAnswer({ email: candidate, result: NO_SSO });
        });
    }, delayMs);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [candidate, delayMs]);

  return answer?.email === candidate ? answer.result : NO_SSO;
}
