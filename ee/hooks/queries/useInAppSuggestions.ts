"use client";
import { useMemo } from "react";
import { useAnalyticsEventFieldsQuery } from "@/hooks/queries/useAnalyticsEventsQueries";
import { usableKey } from "@ee/lib/inAppComposer";

const USER = "user.";

// What the project has actually recorded, so nobody has to remember how a key is spelled.
export function useInAppSuggestions(projectId: string) {
  const query = useAnalyticsEventFieldsQuery(projectId);
  return useMemo(() => {
    const fields = query.data?.fields ?? [];
    return {
      loading: query.isPending,
      userAttributes: fields
        .filter((f) => f.type === "user_attribute")
        .map((f) =>
          f.name.startsWith(USER) ? f.name.slice(USER.length) : f.name
        )
        .filter(usableKey)
        .sort(),
      eventProperties: fields
        .filter((f) => f.type === "property")
        .map((f) => f.name.replace(/^properties\./, ""))
        .filter(usableKey)
        .sort(),
    };
  }, [query.data, query.isPending]);
}

export type InAppSuggestions = ReturnType<typeof useInAppSuggestions>;
