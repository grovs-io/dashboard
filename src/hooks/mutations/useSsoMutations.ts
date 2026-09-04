import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  upsertSsoConnectionAPICall,
  deleteSsoConnectionAPICall,
  verifySsoDomainsAPICall,
  createScimTokenAPICall,
  deleteScimTokenAPICall,
} from "@/api/sso/ssoService";
import type { SsoConnectionUpsertPayload } from "@/types";

function useInvalidateSso(instanceId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!instanceId) return;
    queryClient.invalidateQueries({
      queryKey: queryKeys.instances.ssoConnection(instanceId),
    });
    // Every write here is an audit event.
    queryClient.invalidateQueries({
      queryKey: queryKeys.instances.auditEventsAll(instanceId),
    });
  };
}

export function useUpsertSsoConnectionMutation(instanceId: string | undefined) {
  const invalidate = useInvalidateSso(instanceId);
  return useMutation({
    mutationFn: (payload: SsoConnectionUpsertPayload) =>
      upsertSsoConnectionAPICall(instanceId!, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteSsoConnectionMutation(instanceId: string | undefined) {
  const invalidate = useInvalidateSso(instanceId);
  return useMutation({
    mutationFn: () => deleteSsoConnectionAPICall(instanceId!),
    onSuccess: invalidate,
  });
}

export function useVerifySsoDomainsMutation(instanceId: string | undefined) {
  const invalidate = useInvalidateSso(instanceId);
  return useMutation({
    mutationFn: () => verifySsoDomainsAPICall(instanceId!),
    onSuccess: invalidate,
  });
}

export function useCreateScimTokenMutation(instanceId: string | undefined) {
  const invalidate = useInvalidateSso(instanceId);
  return useMutation({
    mutationFn: () => createScimTokenAPICall(instanceId!),
    onSuccess: invalidate,
  });
}

export function useDeleteScimTokenMutation(instanceId: string | undefined) {
  const invalidate = useInvalidateSso(instanceId);
  return useMutation({
    mutationFn: () => deleteScimTokenAPICall(instanceId!),
    onSuccess: invalidate,
  });
}
