// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IS_SELF_HOSTED } from "@/lib/edition";
import { buildContentSecurityPolicy } from "@/lib/contentSecurityPolicy";

const aliasMap: Record<string, string> = {
  "/new-password": "/new_password",
  "/links": "/dynamic_links/links",
  "/settings/subscription": "/settings",
  // The Overview is now the dashboard; keep old links/bookmarks working.
  "/analytics/overview": "/dashboard",
  // add more one-to-one aliases here
};

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const { pathname } = url;

  if (
    IS_SELF_HOSTED &&
    (pathname === "/register" || pathname.startsWith("/register/"))
  ) {
    const to = new URL(url);
    to.pathname = "/login";
    return NextResponse.redirect(to, 307);
  }

  // direct match
  if (aliasMap[pathname]) {
    const to = new URL(url);
    to.pathname = aliasMap[pathname];
    return NextResponse.redirect(to, 308);
  }

  // optional: also handle nested paths like /user-profile/123/edit
  for (const [from, toPath] of Object.entries(aliasMap)) {
    if (pathname.startsWith(from + "/")) {
      const rest = pathname.slice(from.length); // keeps "/123/edit"
      const to = new URL(url);
      to.pathname = toPath + rest;
      return NextResponse.redirect(to, 308);
    }
  }

  const response = NextResponse.next();
  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl) {
    response.headers.set(
      "Content-Security-Policy",
      buildContentSecurityPolicy({
        apiUrl,
        nodeEnv: process.env.NODE_ENV,
        posthogUrl: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        posthogEnabled: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
        gtmEnabled: Boolean(process.env.NEXT_PUBLIC_GTM_ID),
        chatwootUrl: process.env.NEXT_PUBLIC_CHATWOOT_URL,
        chatwootEnabled:
          !IS_SELF_HOSTED &&
          Boolean(process.env.NEXT_PUBLIC_CHATWOOT_URL) &&
          Boolean(process.env.NEXT_PUBLIC_CHATWOOT_TOKEN),
      })
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\.(?:png|jpg|jpeg|svg|ico|txt|xml)).*)"],
};
