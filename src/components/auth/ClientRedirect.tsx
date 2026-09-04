"use client";

import { useUserContext } from "@/context/useUserContext";
import LocalStorage from "@/lib/LocalStorage";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ClientRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isHydrated } = useUserContext();

  useEffect(() => {
    if (!isHydrated) return; // wait until context is ready

    // SSO completes by redirecting back here with tokens in the URL.
    // Capture them before deciding where to send the user.
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refresh_token");
    if (token && refreshToken) {
      LocalStorage.setAuthenticationToken(token);
      LocalStorage.setRefreshToken(refreshToken);

      // Strip the tokens from the URL immediately so they can't leak via
      // browser history or the Referer header on any subsequent request.
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      url.searchParams.delete("refresh_token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    const authToken = LocalStorage.getAuthenticationToken();

    if (!authToken) {
      // SSO failures also land here, as ?error= — forward it so login can show it.
      const ssoError = searchParams.get("error");
      router.replace(
        ssoError ? `/login?error=${encodeURIComponent(ssoError)}` : "/login"
      );
    } else {
      router.replace("/dashboard");
    }
  }, [router, isHydrated, searchParams]);

  return null;
}
