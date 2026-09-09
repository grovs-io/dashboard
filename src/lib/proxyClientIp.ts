import { serverConfig } from "@/lib/serverConfig";

// Auth is proxied server-side, so the backend sees this container's egress IP; forward the caller's.
// TRUSTED_PROXY_SECRET is the proof the backend checks; unset means the headers are simply not sent.
export const proxyClientIpHeaders = (
  request: Request
): Record<string, string> => {
  const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  const secret = serverConfig.trustedProxySecret;
  if (!ip || !secret) return {};

  return { "X-Grovs-Client-IP": ip, "X-Grovs-Proxy-Auth": secret };
};
