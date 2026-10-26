// Pure rules for the guided setup: which step and part to resume at, derived from saved data.
import { httpUrlSchema } from "@/schemas/shared";

export type SetupStepKey = "domain" | "app" | "links" | "try";
export type SetupView = SetupStepKey | "done";
export type Platform = "ios" | "android" | "web";

export const SETUP_STEPS: { key: SetupStepKey; label: string }[] = [
  { key: "domain", label: "Link domain" },
  { key: "app", label: "Connect your app" },
  { key: "links", label: "Links" },
  { key: "try", label: "Try it" },
];

export const ONBOARDING_CATEGORY = "onboarding";
export const LINK_DOMAIN_STEP = "link_domain";
// Recorded the first time the SDK is seen, so the app step stays done.
export const APP_CONNECTED_STEP = "app_connected";

export interface SetupSignals {
  domainMarked: boolean;
  customDomain: boolean;
  appConnected: boolean;
  appMarked: boolean;
  fallbackSet: boolean;
  hasLinks: boolean;
}

export function completedSteps(s: SetupSignals): Record<SetupStepKey, boolean> {
  // Any later progress means the domain was settled before it.
  const app = s.appConnected || s.appMarked;
  const later = app || s.fallbackSet || s.hasLinks;
  return {
    domain: s.domainMarked || s.customDomain || later,
    app,
    links: s.fallbackSet,
    try: s.hasLinks,
  };
}

export function resumeView(s: SetupSignals): SetupView {
  const done = completedSteps(s);
  return SETUP_STEPS.find((step) => !done[step.key])?.key ?? "done";
}

export const isSetupComplete = (s: SetupSignals) => resumeView(s) === "done";

export function isSetupView(value: string | null): value is SetupView {
  return value === "done" || SETUP_STEPS.some((step) => step.key === value);
}

export function isPlatform(value: string | null): value is Platform {
  return value === "ios" || value === "android" || value === "web";
}

// --- Connect your app ---

export interface PlatformSignals {
  registered: boolean;
  walked: ReadonlySet<string>;
  seen: boolean;
}

export interface PartState {
  key: string;
  done: boolean;
}

// Part keys double as the existing setup-progress identifiers of each platform guide.
export const PLATFORM_PARTS: Record<Platform, string[]> = {
  ios: ["register_app", "url_scheme", "add_sdk", "initialize_sdk", "run"],
  android: [
    "register_app",
    "intent_filters",
    "add_sdk",
    "initialize_sdk",
    "run",
  ],
  web: ["register_domains", "add_sdk", "integrate_sdk", "run"],
};

export const SETUP_CATEGORY: Record<Platform, string> = {
  ios: "ios_setup",
  android: "android_setup",
  web: "web_setup",
};

export function platformParts(
  platform: Platform,
  s: PlatformSignals
): PartState[] {
  const [first, ...rest] = PLATFORM_PARTS[platform];
  return [
    { key: first!, done: s.registered },
    ...rest.map((key) => ({
      key,
      done: key === "run" ? s.seen : s.walked.has(key),
    })),
  ];
}

/** First part still to do; parts.length when all are done. */
export function currentPart(parts: PartState[]): number {
  const index = parts.findIndex((part) => !part.done);
  return index === -1 ? parts.length : index;
}

export function doneCount(parts: PartState[]): number {
  return parts.filter((part) => part.done).length;
}

/** Platform to open on: one that's half set up, else the first not connected. */
export function defaultPlatform(
  signals: Record<Platform, PlatformSignals>
): Platform {
  const order: Platform[] = ["ios", "android", "web"];
  return (
    order.find((p) => signals[p].registered && !signals[p].seen) ??
    order.find((p) => p !== "web" && !signals[p].seen) ??
    "ios"
  );
}

// --- Helpers ---

/** Lines touching Grovs, plus any block they open, are the ones to add. */
export function markAddedLines(
  code: string
): { text: string; added: boolean }[] {
  let depth = 0;
  return code
    .replace(/\s+$/, "")
    .split("\n")
    .map((text) => {
      const opens = (text.match(/{/g) ?? []).length;
      const closes = (text.match(/}/g) ?? []).length;
      if (depth > 0) {
        depth = Math.max(0, depth + opens - closes);
        return { text, added: true };
      }
      if (/grovs/i.test(text)) {
        depth = Math.max(0, opens - closes);
        return { text, added: true };
      }
      return { text, added: false };
    });
}

export function slugify(value: string, max = 40): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

export const MIN_SUBDOMAIN_LENGTH = 5;

export function sanitizeSubdomain(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/** Short alternatives built from the project name. */
export function subdomainIdeas(projectName: string, current: string): string[] {
  const words = slugify(projectName).split("-").filter(Boolean);
  const first = words[0] ?? "";
  const joined = words.join("");
  const ideas = [
    joined,
    first,
    `${first}-app`,
    `try-${first}`,
    `${joined}-app`,
    `get-${first}`,
  ];
  return [...new Set(ideas)]
    .filter((i) => i.length >= MIN_SUBDOMAIN_LENGTH && i !== current)
    .slice(0, 3);
}

/** Splits "https://host/path" into the part after the fixed https:// prefix. */
export function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//i, "");
}

export function withScheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value) && httpUrlSchema.safeParse(value).success;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(
    0,
    Math.round((now - new Date(iso).getTime()) / 1000)
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** /setup for a project, keeping the environment the app has in its URL. */
export function setupHref(instanceId: string | number): string {
  const params = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search
  );
  params.delete("step");
  params.delete("platform");
  params.set("instance_id", String(instanceId));
  return `/setup?${params.toString()}`;
}
