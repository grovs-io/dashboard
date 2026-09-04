import { redirect } from "next/navigation";

// The Analytics Overview has been merged into the dashboard. Redirect any
// direct/soft navigation here to /dashboard, preserving query params. Hard
// loads are also handled at the edge by the proxy alias map.
export default async function AnalyticsOverviewRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.append(key, value);
  }
  const query = qs.toString();
  redirect(`/dashboard${query ? `?${query}` : ""}`);
}
