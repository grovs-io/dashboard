import type {
  EventCategory,
  EventOccurrence,
  EventVolumeBin,
  QueryFilter,
} from "./types";

export const EVENT_NAMES = [
  "screen_view",
  "app_launch",
  "login_start",
  "login_complete",
  "signup_start",
  "signup_complete",
  "purchase_start",
  "purchase_complete",
  "add_to_cart",
  "remove_from_cart",
  "search",
  "share",
  "notification_open",
  "notification_dismiss",
  "deep_link_open",
  "onboarding_start",
  "onboarding_complete",
  "profile_view",
  "settings_open",
  "logout",
];

export const CATEGORY_MAP: Record<string, EventCategory> = {
  screen_view: "navigation",
  app_launch: "lifecycle",
  login_start: "lifecycle",
  login_complete: "lifecycle",
  signup_start: "lifecycle",
  signup_complete: "lifecycle",
  purchase_start: "revenue",
  purchase_complete: "revenue",
  add_to_cart: "revenue",
  remove_from_cart: "revenue",
  search: "engagement",
  share: "engagement",
  notification_open: "engagement",
  notification_dismiss: "engagement",
  deep_link_open: "navigation",
  onboarding_start: "lifecycle",
  onboarding_complete: "lifecycle",
  profile_view: "navigation",
  settings_open: "navigation",
  logout: "lifecycle",
};

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  engagement: "var(--chart-1)",
  lifecycle: "var(--chart-2)",
  revenue: "var(--chart-3)",
  navigation: "var(--chart-4)",
  system: "var(--chart-5)",
};

const PLATFORMS: EventOccurrence["platform"][] = ["iOS", "Android", "Web"];
const PLATFORM_WEIGHTS = [0.55, 0.35, 0.1];

const DEVICES: Record<string, string[]> = {
  iOS: ["iPhone 15", "iPhone 15 Pro", "iPhone 14", "iPhone SE", "iPad Pro"],
  Android: [
    "Pixel 8",
    "Samsung Galaxy S24",
    "Samsung Galaxy A54",
    "OnePlus 12",
    "Xiaomi 14",
  ],
  Web: ["Chrome", "Safari", "Firefox", "Edge"],
};

const OS_VERSIONS: Record<string, string[]> = {
  iOS: ["iOS 18.2", "iOS 18.1", "iOS 17.6", "iOS 17.5"],
  Android: ["Android 15", "Android 14", "Android 13"],
  Web: ["Web"],
};

const APP_VERSIONS = ["2.4.0", "2.3.1", "2.3.0", "2.2.0"];
const COUNTRIES = ["US", "GB", "DE", "FR", "CA", "AU", "JP", "BR", "IN", "ES"];
const CITIES = [
  "New York",
  "London",
  "Berlin",
  "Paris",
  "Toronto",
  "Sydney",
  "Tokyo",
  "São Paulo",
  "Mumbai",
  "Madrid",
];

function pickWeighted<T>(items: T[], weights: number[]): T {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i]!;
    if (r < cumulative) return items[i]!;
  }
  return items[items.length - 1]!;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateProperties(
  eventName: string
): Record<string, string | number | boolean> {
  switch (eventName) {
    case "screen_view":
      return {
        screen_name: pick(["Home", "Browse", "Profile", "Settings", "Search"]),
        duration_ms: Math.round(Math.random() * 10000),
      };
    case "purchase_complete":
    case "purchase_start":
      return {
        product_id: `prod_${Math.random().toString(36).substring(2, 8)}`,
        amount: parseFloat((Math.random() * 99.99 + 0.99).toFixed(2)),
        currency: pick(["USD", "EUR", "GBP"]),
      };
    case "add_to_cart":
    case "remove_from_cart":
      return {
        product_id: `prod_${Math.random().toString(36).substring(2, 8)}`,
        quantity: Math.floor(Math.random() * 5) + 1,
      };
    case "search":
      return {
        query: pick([
          "shoes",
          "headphones",
          "laptop",
          "gift cards",
          "sale",
          "new arrivals",
        ]),
        results_count: Math.floor(Math.random() * 50),
      };
    case "share":
      return {
        content_type: pick(["product", "article", "profile"]),
        share_method: pick(["link", "email", "social"]),
      };
    case "notification_open":
    case "notification_dismiss":
      return {
        notification_type: pick(["promo", "transactional", "reminder"]),
        campaign_id: `cmp_${Math.random().toString(36).substring(2, 6)}`,
      };
    case "deep_link_open":
      return {
        link_id: `lnk_${Math.random().toString(36).substring(2, 8)}`,
        source: pick(["email", "sms", "social", "qr_code"]),
      };
    default:
      return {
        session_duration: Math.round(Math.random() * 300),
      };
  }
}

// Seeded pseudo-random for deterministic generation
let seed = 42;
function seededRandom(): number {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

export function generateEventOccurrences(count: number): EventOccurrence[] {
  seed = 42; // reset seed for deterministic output
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return Array.from({ length: count }, (_, i) => {
    const eventName =
      EVENT_NAMES[Math.floor(seededRandom() * EVENT_NAMES.length)]!;
    const platform = pickWeighted(PLATFORMS, PLATFORM_WEIGHTS);
    const timestamp = new Date(
      now - Math.floor(seededRandom() * thirtyDaysMs)
    ).toISOString();

    return {
      id: `evt_${i.toString(36).padStart(4, "0")}`,
      event_type: CATEGORY_MAP[eventName] ?? "custom",
      event_name: eventName,
      timestamp,
      user_id: `usr_${Math.random().toString(36).substring(2, 8)}`,
      visitor_uuid: null,
      resolved_visitor_id: null,
      session_id: `ses_${Math.random().toString(36).substring(2, 8)}`,
      platform,
      app_version: pick(APP_VERSIONS),
      device_model: pick(DEVICES[platform]!),
      os_version: pick(OS_VERSIONS[platform]!),
      country: pick(COUNTRIES),
      city: pick(CITIES),
      category: CATEGORY_MAP[eventName] ?? "system",
      properties: generateProperties(eventName),
    };
  });
}

export const ALL_EVENTS = generateEventOccurrences(500);

export function getFieldValues(field: string): string[] {
  const seen = new Set<string>();
  for (const e of ALL_EVENTS) {
    const topLevel = e[field as keyof EventOccurrence];
    if (topLevel !== undefined && typeof topLevel !== "object") {
      seen.add(String(topLevel));
    } else if (field in (e.properties ?? {})) {
      seen.add(String(e.properties[field]));
    }
  }
  return Array.from(seen).sort();
}

/** Returns all unique property keys across all events */
export function getPropertyKeys(): string[] {
  const seen = new Set<string>();
  for (const e of ALL_EVENTS) {
    for (const key of Object.keys(e.properties)) {
      seen.add(key);
    }
  }
  return Array.from(seen).sort();
}

/** Deep free-text search across all event fields + properties */
function matchesSearch(e: EventOccurrence, term: string): boolean {
  const lower = term.toLowerCase();
  // Top-level fields
  if (e.event_name.toLowerCase().includes(lower)) return true;
  if (e.user_id.toLowerCase().includes(lower)) return true;
  if (e.session_id.toLowerCase().includes(lower)) return true;
  if (e.platform.toLowerCase().includes(lower)) return true;
  if (e.app_version.toLowerCase().includes(lower)) return true;
  if (e.device_model.toLowerCase().includes(lower)) return true;
  if (e.os_version.toLowerCase().includes(lower)) return true;
  if (e.country.toLowerCase().includes(lower)) return true;
  if (e.city.toLowerCase().includes(lower)) return true;
  if (e.category.toLowerCase().includes(lower)) return true;
  // Properties
  for (const val of Object.values(e.properties)) {
    if (String(val).toLowerCase().includes(lower)) return true;
  }
  return false;
}

function matchesQueryFilters(
  e: EventOccurrence,
  queryFilters: QueryFilter[]
): boolean {
  // Group filters by field
  const byField = new Map<string, QueryFilter[]>();
  for (const f of queryFilters) {
    const group = byField.get(f.field) ?? [];
    group.push(f);
    byField.set(f.field, group);
  }

  for (const [field, filters] of byField) {
    // Resolve value from top-level fields or properties
    const topLevel = e[field as keyof EventOccurrence];
    const strVal =
      topLevel !== undefined && typeof topLevel !== "object"
        ? String(topLevel)
        : field in (e.properties ?? {})
          ? String(e.properties[field])
          : undefined;

    const includes = filters.filter((f) => f.operator === "is");
    const excludes = filters.filter((f) => f.operator === "is_not");
    const contains = filters.filter((f) => f.operator === "contains");

    // "is" filters on same field → OR (match any)
    if (includes.length > 0) {
      if (strVal === undefined || !includes.some((f) => f.value === strVal)) {
        return false;
      }
    }
    // "is_not" filters → AND (match none)
    if (excludes.length > 0) {
      if (strVal !== undefined && excludes.some((f) => f.value === strVal)) {
        return false;
      }
    }
    // "contains" filters → OR (match any substring)
    if (contains.length > 0) {
      if (
        strVal === undefined ||
        !contains.some((f) =>
          strVal.toLowerCase().includes(f.value.toLowerCase())
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

export function filterEvents(
  events: EventOccurrence[],
  filters: {
    search?: string;
    platform?: string;
    eventName?: string;
    category?: string;
    dateRange?: { from: Date; to: Date };
    queryFilters?: QueryFilter[];
  }
): EventOccurrence[] {
  return events.filter((e) => {
    if (filters.search && !matchesSearch(e, filters.search)) return false;
    if (
      filters.platform &&
      e.platform.toLowerCase() !== filters.platform.toLowerCase()
    )
      return false;
    if (filters.eventName && e.event_name !== filters.eventName) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.dateRange) {
      const ts = new Date(e.timestamp);
      if (ts < filters.dateRange.from || ts > filters.dateRange.to)
        return false;
    }
    if (filters.queryFilters && !matchesQueryFilters(e, filters.queryFilters))
      return false;
    return true;
  });
}

export function sortEvents(
  events: EventOccurrence[],
  sortKey: string,
  ascending: boolean
): EventOccurrence[] {
  const sorted = [...events].sort((a, b) => {
    const aVal = a[sortKey as keyof EventOccurrence] ?? "";
    const bVal = b[sortKey as keyof EventOccurrence] ?? "";
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
  return ascending ? sorted : sorted.reverse();
}

export function paginateEvents<T>(
  events: T[],
  page: number,
  perPage: number
): { data: T[]; totalPages: number; totalRows: number } {
  const totalRows = events.length;
  const totalPages = Math.ceil(totalRows / perPage);
  const start = (page - 1) * perPage;
  return {
    data: events.slice(start, start + perPage),
    totalPages,
    totalRows,
  };
}

/** Build histogram bins for the volume chart, bucketed by hour */
export function buildVolumeBins(events: EventOccurrence[]): EventVolumeBin[] {
  if (events.length === 0) return [];

  const bins = new Map<string, EventVolumeBin>();

  for (const e of events) {
    const d = new Date(e.timestamp);
    const key = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours()
    ).toISOString();

    let bin = bins.get(key);
    if (!bin) {
      bin = {
        time: key,
        label: d.toLocaleTimeString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        count: 0,
      };
      bins.set(key, bin);
    }
    bin.count++;
  }

  return Array.from(bins.values()).sort((a, b) => a.time.localeCompare(b.time));
}
