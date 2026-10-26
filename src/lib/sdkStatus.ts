import type { SdkStatus } from "@/types";

export type SetupKind = "events" | "purchases" | "links";

/** True when the dashboard has nothing to show yet; an unknown status shows the dashboard. */
export function needsSetup(kind: SetupKind, status?: SdkStatus): boolean {
  if (!status) return false;
  if (kind === "purchases") return !status.has_purchases;
  if (kind === "links") return !status.has_links;
  return !status.has_events;
}
