"use client";

import { useEffect } from "react";
import { capturePosthog } from "@/analytics/posthog";
import { categorizeError } from "@/lib/errorUtils";
import { ErrorState } from "@/components/common/ErrorState";

export default function AudienceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught in audience/error.tsx:", error);
    capturePosthog("error_boundary_triggered", {
      error_message: error.message,
      error_digest: error.digest,
      route_group: "audience",
    });
  }, [error]);

  const { title, description } = categorizeError(error);

  return <ErrorState title={title} description={description} onRetry={reset} />;
}
