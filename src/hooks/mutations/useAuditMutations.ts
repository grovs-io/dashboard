import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  createAuditExportTokenAPICall,
  revokeAuditExportTokenAPICall,
} from "@/api/audit/auditService";

function useInvalidateAudit(instanceId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!instanceId) return;
    queryClient.invalidateQueries({
      queryKey: queryKeys.instances.auditExportTokens(instanceId),
    });
    // Token create/revoke are themselves audit events.
    queryClient.invalidateQueries({
      queryKey: queryKeys.instances.auditEventsAll(instanceId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.instances.auditHead(instanceId),
    });
  };
}

export function useCreateAuditExportTokenMutation(
  instanceId: string | undefined
) {
  const invalidate = useInvalidateAudit(instanceId);
  return useMutation({
    mutationFn: (payload: { name: string }) =>
      createAuditExportTokenAPICall(instanceId!, payload),
    onSuccess: invalidate,
  });
}

export function useRevokeAuditExportTokenMutation(
  instanceId: string | undefined
) {
  const invalidate = useInvalidateAudit(instanceId);
  return useMutation({
    mutationFn: (tokenId: string) =>
      revokeAuditExportTokenAPICall(instanceId!, tokenId),
    onSuccess: invalidate,
  });
}
