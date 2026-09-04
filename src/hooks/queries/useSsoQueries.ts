import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { IS_SELF_HOSTED } from "@/lib/edition";
import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import { useIsInstanceAdmin } from "@/hooks/useIsInstanceAdmin";
import { getSsoConnectionAPICall } from "@/api/sso/ssoService";
import type { SsoConnection } from "@/types";

// Same entitlement as the audit log: self-hosted, or an enterprise subscription.
export function useSsoAccess(instanceId: string | undefined): {
  allowed: boolean;
  isResolving: boolean;
} {
  const subscriptionQuery = useSubscriptionQuery(instanceId);
  const isAdmin = useIsInstanceAdmin();
  const entitled =
    !!instanceId &&
    (IS_SELF_HOSTED || subscriptionQuery.data?.isEnterprise === true);
  const isResolving =
    !!instanceId && !IS_SELF_HOSTED && subscriptionQuery.isPending;
  return { allowed: entitled && isAdmin, isResolving };
}

export function useSsoConnectionQuery(
  instanceId: string | undefined,
  enabled = true
) {
  return useQuery<SsoConnection | null>({
    queryKey: queryKeys.instances.ssoConnection(instanceId!),
    queryFn: async () => {
      const response = await getSsoConnectionAPICall(instanceId!);
      return response.data.sso_connection;
    },
    enabled: enabled && !!instanceId,
  });
}
