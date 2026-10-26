"use client";
import { useEffect, useState } from "react";

// A 410 for a pinned result recovers silently once per id; Reload asks again and the caller shows retry after that.
export function useRecoverExpiredResult(
  expired: boolean,
  resultId: string | undefined,
  computing: boolean,
  onExpired?: () => void
) {
  const [recoveredFor, setRecoveredFor] = useState<string | undefined>(
    undefined
  );
  useEffect(() => {
    if (!expired || !onExpired || recoveredFor === resultId) return;
    setRecoveredFor(resultId);
    onExpired();
  }, [expired, resultId, onExpired, recoveredFor]);
  return {
    recovering: expired && (computing || recoveredFor !== resultId),
    reload: () => setRecoveredFor(undefined),
  };
}
