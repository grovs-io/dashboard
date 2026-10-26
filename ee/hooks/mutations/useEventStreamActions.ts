"use client";
import { useEffect, useRef, useState } from "react";
import type { AxiosResponse } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { ApiError } from "@/lib/ApiError";
import { streamError } from "@ee/lib/eventStream";

// Direct execution deliberately avoids MutationCache: request variables contain
// credentials and create responses contain one-time secrets. Neither may linger
// in query devtools/cache after the form closes.
export function useEventStreamActions(
  projectId: string,
  onAccessError: (status: number) => void
) {
  const client = useQueryClient();
  const mounted = useRef(false);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const creationBlocked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function reconcile() {
    try {
      await client.invalidateQueries(
        { queryKey: queryKeys.projects.detail(projectId), refetchType: "all" },
        { throwOnError: true }
      );
      creationBlocked.current = false;
      if (mounted.current) setReconciliationRequired(false);
    } catch {
      creationBlocked.current = true;
      if (mounted.current) setReconciliationRequired(true);
    }
  }

  async function recover() {
    if (busy.current || !mounted.current) return;
    busy.current = true;
    setPending(true);
    await reconcile();
    if (mounted.current) {
      busy.current = false;
      setPending(false);
    }
  }

  async function run<T>(
    operation: () => Promise<AxiosResponse<T>>,
    creation = false
  ): Promise<T | undefined> {
    if (
      busy.current ||
      !mounted.current ||
      (creation && creationBlocked.current)
    )
      return;
    busy.current = true;
    setPending(true);
    setError("");
    let uncertain = false;
    try {
      const response = await operation();
      return mounted.current ? response.data : undefined;
    } catch (cause) {
      if (mounted.current) {
        if (
          cause instanceof ApiError &&
          (cause.status === 402 || cause.status === 403)
        )
          onAccessError(cause.status);
        uncertain =
          creation &&
          (!(cause instanceof ApiError) ||
            cause.status === 0 ||
            cause.status >= 500);
        setError(
          uncertain
            ? `${streamError(cause)} Creation may have succeeded. Check the refreshed list before trying again; a lost secret cannot be retrieved.`
            : streamError(cause)
        );
      }
      return undefined;
    } finally {
      // Always invalidate the originating project, even after it has unmounted.
      if (uncertain) {
        creationBlocked.current = true;
        await reconcile();
      } else {
        void client.invalidateQueries({
          queryKey: queryKeys.projects.detail(projectId),
        });
      }
      if (mounted.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  return {
    run,
    pending,
    error,
    reconciliationRequired,
    recover,
    clearError: () => setError(""),
  };
}
export type StreamActions = ReturnType<typeof useEventStreamActions>;
