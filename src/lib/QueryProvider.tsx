"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/ApiError";

const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then((mod) => ({
      default: mod.ReactQueryDevtools,
    })),
  { ssr: false }
);

// One retry for network and 5xx failures; a 4xx or 503 answer will not change.
export const shouldRetry = (failureCount: number, error: unknown) =>
  failureCount < 1 &&
  !(
    error instanceof ApiError &&
    (error.status === 503 || (error.status >= 400 && error.status < 500))
  );

export default function QueryProvider({ children }: { children: ReactNode }) {
  // The floating devtools button would cover the guided setup's footer.
  const fullScreen = usePathname()?.startsWith("/setup") ?? false;
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: shouldRetry,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && !fullScreen && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
