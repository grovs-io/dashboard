"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/context/useUserContext";
import PageSkeleton from "@/components/common/PageSkeleton";

import LocalStorage from "./LocalStorage";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { fetchCurrentUser, userRef } = useUserContext();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const hasRunRef = useRef(false);

  // Runs once per mount — depending on the query string re-requested /users/me on every filter change.
  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const refreshToken = params.get("refresh_token");

    if (token && refreshToken) {
      LocalStorage.setAuthenticationToken(token);
      LocalStorage.setRefreshToken(refreshToken);

      // Remove tokens from URL immediately to prevent leaking via history/referer.
      // history.replaceState is synchronous (no navigation/re-render round-trip),
      // so the token never sits in a readable URL while async auth runs below.
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      url.searchParams.delete("refresh_token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }

    const authToken = LocalStorage.getAuthenticationToken();

    if (!authToken) {
      setHasCheckedAuth(true);
      const currentPath = window.location.pathname + window.location.search;
      router.replace(`/login?backTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    const checkAuth = async () => {
      try {
        await fetchCurrentUser();
        setHasCheckedAuth(true);
      } catch {
        const currentPath = window.location.pathname + window.location.search;
        router.replace(`/login?backTo=${encodeURIComponent(currentPath)}`);
      }
    };
    checkAuth();
  }, [router, fetchCurrentUser]);

  // Don't render children until auth is verified
  if (!hasCheckedAuth || !userRef.current) {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}
