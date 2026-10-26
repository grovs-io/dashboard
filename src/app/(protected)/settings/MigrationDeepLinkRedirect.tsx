"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Listens for legacy migration deep-links on `/settings` and forwards them to
 * the canonical migration card on `/dynamic_links/settings/domain`.
 *
 * Triggers when either:
 * - `?tab=migration` is present in the query string, OR
 * - the URL fragment contains the substring `migration` (case-insensitive).
 *
 * The `tab` param is dropped from the redirect target so the effect cannot
 * loop after `router.replace`. `instance_id` and `env_type` are preserved so
 * downstream pages keep the project context the user clicked into.
 *
 * Note: Next.js `useSearchParams` does not expose the URL fragment, so we
 * read `window.location.hash` directly for the hash case.
 */
const MigrationDeepLinkRedirect = ({
  fallback,
}: {
  // Where to send the visitor when it isn't a migration link.
  fallback?: string;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashRequestsMigration = hash.toLowerCase().includes("migration");

    if (tab !== "migration" && !hashRequestsMigration) {
      // Legacy Stripe cancel URL `/settings?cancel=true<instance id>` belongs on Usage & Billing.
      const cancel = searchParams.get("cancel");
      if (fallback && cancel?.startsWith("true")) {
        const params = new URLSearchParams();
        const instanceId = searchParams.get("instance_id") || cancel.slice(4);
        if (instanceId) params.set("instance_id", instanceId);
        const envType = searchParams.get("env_type");
        if (envType) params.set("env_type", envType);
        params.set("cancel", "true");
        router.replace(`/settings/usage?${params}`);
        return;
      }
      if (fallback) {
        const query = searchParams.toString();
        router.replace(`${fallback}${query ? `?${query}` : ""}`);
      }
      return;
    }

    const preservedKeys = ["instance_id", "env_type"] as const;
    const preserved = new URLSearchParams();
    preservedKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) preserved.set(key, value);
    });

    const query = preserved.toString();
    const target = `/dynamic_links/settings/domain${
      query ? `?${query}` : ""
    }#migration`;

    router.replace(target);
  }, [router, searchParams, fallback]);

  return null;
};

export default MigrationDeepLinkRedirect;
