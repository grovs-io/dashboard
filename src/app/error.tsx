"use client";

import { useEffect } from "react";
import { capturePosthog } from "@/analytics/posthog";
import { categorizeError } from "@/lib/errorUtils";
import { ErrorState } from "@/components/common/ErrorState";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught in error.tsx:", error);
    capturePosthog("error_boundary_triggered", {
      error_message: error.message,
      error_digest: error.digest,
    });
  }, [error]);

  const { title, description } = categorizeError(error);

  return (
    <div className="flex w-full min-h-screen items-center justify-center bg-background">
      <ErrorState
        title={title}
        description={description}
        onRetry={reset}
        showDashboardLink
      />
    </div>
  );
}
