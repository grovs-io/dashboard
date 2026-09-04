import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const mapKeyPairValues = (
  keyPairValue: Record<string, string> | null | undefined
): { key: string; value: string }[] => {
  if (!keyPairValue) {
    return [];
  }
  const newData = Object.entries(keyPairValue).map(([key, value]) => ({
    key,
    value,
  }));
  return newData;
};

export const parseSecondsInDaysHoursMinutesSeconds = (
  value: number | null | undefined
) => {
  if (!value) return "00:00:00";

  const totalSeconds = Number(value);

  const days = Math.floor(totalSeconds / 86400); // 24 * 3600
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (days > 1) {
    return `${days} days and ${hours} hours`;
  } else if (days === 1) {
    return `${days} day and ${hours} hours`;
  }

  const formattedTime = `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return formattedTime;
};

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    // Handle NaN === NaN (Object.is already covers this, but be explicit)
    if (typeof a === "number" && typeof b === "number") {
      return Number.isNaN(a) && Number.isNaN(b);
    }
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!deepEqual(objA[key], objB[key])) return false;
  }

  return true;
}

/**
 * Deep clone a JSON-serializable value. Non-serializable values (File, Date, Map, etc.)
 * will be lost — only use on plain objects/arrays with primitive values.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format a Date as a YYYY-MM-DD string for API query params, using the user's
 * LOCAL calendar date. `toISOString()` would convert to UTC first, which shifts
 * the date by a day for users east/west of UTC (e.g. "Today" at UTC+3 midnight
 * serializes as yesterday) — corrupting "today" ranges and inflating clamped
 * windows by a day. The day picker works in local time, so the param must too.
 */
export function formatDateParam(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date as a local "YYYY-MM-DD HH:mm:ss" string for time-aware API
 * range params. Local (not UTC) for the same reason as {@link formatDateParam}.
 */
export function formatDateTimeParam(d: Date): string {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${formatDateParam(d)} ${hours}:${minutes}:${seconds}`;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Convert an ISO 3166-1 alpha-2 country code to its full name. */
export function countryName(code: string): string {
  if (!code) return "";
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Format a number for compact display (e.g. 1200 → "1.2K") */
export function fmt(n: number): string {
  if (n == null) return "0";
  if (n >= 1000) {
    const k = n / 1000;
    return k >= 10
      ? `${Math.round(k)}K`
      : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
}

export function formatPlatformName(platform: string) {
  if (!platform) return "";

  if (platform.toLowerCase() === "ios") {
    return "iOS";
  }

  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
