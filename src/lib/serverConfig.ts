// Server-only. OAUTH_CLIENT_UID/SECRET are read at runtime (not NEXT_PUBLIC_, so
// not baked into the browser bundle) and are the same pair the backend uses.
// Falls back to the legacy NEXT_PUBLIC_CLIENT_ID/CLIENT_SECRET so existing
// staging/prod deployments keep working without an env change.
export const serverConfig = {
  apiUrl: process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL,
  apiPath: process.env.NEXT_PUBLIC_API_PATH ?? "/api/v1",
  clientId: process.env.OAUTH_CLIENT_UID ?? process.env.NEXT_PUBLIC_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET ?? process.env.CLIENT_SECRET,
};
