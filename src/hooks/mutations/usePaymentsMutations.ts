import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { PlanChoice } from "@/types/payment";
import {
  createSubscriptionAPICall,
  cancelSubscriptionAPICall,
  resumeSubscriptionAPICall,
} from "@/api/payments/paymentsService";

export function useCreateSubscriptionMutation(instanceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choice: PlanChoice) => {
      if (!instanceId) return Promise.reject(new Error("No instance selected"));
      return createSubscriptionAPICall(instanceId, choice);
    },
    onSuccess: () => {
      if (instanceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.subscription(instanceId),
        });
      }
    },
  });
}

export function useCancelSubscriptionMutation(instanceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!instanceId) return Promise.reject(new Error("No instance selected"));
      return cancelSubscriptionAPICall(instanceId);
    },
    onSuccess: () => {
      if (instanceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.subscription(instanceId),
        });
      }
    },
  });
}

export function useResumeSubscriptionMutation(instanceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!instanceId) return Promise.reject(new Error("No instance selected"));
      return resumeSubscriptionAPICall(instanceId);
    },
    onSuccess: () => {
      if (instanceId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.subscription(instanceId),
        });
      }
    },
  });
}
