import {
  useQuery,
  useInfiniteQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { IS_ENTERPRISE, IS_SELF_HOSTED } from "@/lib/edition";
import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import { useIsInstanceAdmin } from "@/hooks/useIsInstanceAdmin";
import {
  getAuditHeadAPICall,
  getAuditEventsAPICall,
  listAuditExportTokensAPICall,
} from "@/api/audit/auditService";
import type {
  AuditEventFilters,
  AuditEventsResponse,
  AuditHeadResponse,
  AuditExportToken,
} from "@/types";

export const AUDIT_PAGE_SIZE = 50;

// One canonical key for "no filter": empty strings and undefined are dropped.
export function normalizeAuditFilters(
  filters: AuditEventFilters
): AuditEventFilters {
  const out: AuditEventFilters = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      out[key as keyof AuditEventFilters] = value;
    }
  }
  return out;
}

export function useAuditLogEnabled(instanceId: string | undefined): boolean {
  const subscriptionQuery = useSubscriptionQuery(instanceId);
  if (!instanceId) return false;
  // The audit log lives in the enterprise backend; a Community Edition build has no routes for it.
  if (!IS_ENTERPRISE) return false;
  if (IS_SELF_HOSTED) return true;
  return subscriptionQuery.data?.isEnterprise === true;
}

// Entitlement plus the admin role on the selected instance. `isResolving` stays
// true until entitlement is known, so callers don't redirect on a pending query.
export function useAuditLogAccess(instanceId: string | undefined): {
  allowed: boolean;
  isResolving: boolean;
} {
  const enabled = useAuditLogEnabled(instanceId);
  const isAdmin = useIsInstanceAdmin();
  const subscriptionQuery = useSubscriptionQuery(instanceId);

  const isResolving =
    !!instanceId && !IS_SELF_HOSTED && subscriptionQuery.isPending;

  return { allowed: enabled && isAdmin, isResolving };
}

export function useAuditHeadQuery(
  instanceId: string | undefined,
  enabled = true
) {
  return useQuery<AuditHeadResponse>({
    queryKey: queryKeys.instances.auditHead(instanceId!),
    queryFn: async () => {
      const response = await getAuditHeadAPICall(instanceId!);
      return response.data;
    },
    enabled: enabled && !!instanceId,
  });
}

export function useAuditEventsInfiniteQuery(
  instanceId: string | undefined,
  filters: AuditEventFilters = {},
  enabled = true
) {
  const normalized = normalizeAuditFilters(filters);
  return useInfiniteQuery<AuditEventsResponse>({
    queryKey: [
      ...queryKeys.instances.auditEvents(instanceId!, normalized),
      "infinite",
    ],
    queryFn: async ({ pageParam }) => {
      const response = await getAuditEventsAPICall(instanceId!, {
        order: "desc",
        limit: AUDIT_PAGE_SIZE,
        before: pageParam as number | undefined,
        ...normalized,
      });
      return response.data;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.events.length > 0
        ? (lastPage.next_before ?? undefined)
        : undefined,
    placeholderData: keepPreviousData,
    enabled: enabled && !!instanceId,
  });
}

export function useAuditExportTokensQuery(
  instanceId: string | undefined,
  enabled = true
) {
  return useQuery<AuditExportToken[]>({
    queryKey: queryKeys.instances.auditExportTokens(instanceId!),
    queryFn: async () => {
      const response = await listAuditExportTokensAPICall(instanceId!);
      return response.data.audit_export_tokens;
    },
    enabled: enabled && !!instanceId,
  });
}
