"use client";

// Edits the query string in place — router.replace() remounts the page, after which later replace() calls are silently dropped.
export function writeSearchParams(
  updates: Record<string, string | number | null | undefined>
): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;

  // A no-op replace would still cancel a router.push that is in flight.
  if (url === `${window.location.pathname}${window.location.search}`) return;
  window.history.replaceState(null, "", url);
}
