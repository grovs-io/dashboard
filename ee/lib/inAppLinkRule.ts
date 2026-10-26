import { config } from "@/lib/config";

// The shared link rule (backend ee/config/in_app/cases.json, link_rule); keep it in step with the server's.
const FORBIDDEN = new Set([
  "javascript",
  "vbscript",
  "data",
  "blob",
  "file",
  "about",
  "intent",
  "http",
]);
// Ruby's \s, not JavaScript's, which also takes Unicode spaces.
const HTTPS = /^https:\/\/[^/?#\t\n\v\f\r ]+/i;

// As browsers read a URL: no C0 controls or spaces around it, no tabs or line breaks in it.
export function normaliseLink(url: string): string {
  const trimmed = url
    .replace(/^[\u0000- ]+|[\u0000- ]+$/g, "")
    .replace(/[\t\n\r]/g, "");
  return trimmed.replace(/^[A-Za-z][A-Za-z0-9+.-]*(?=:)/, (scheme) =>
    scheme.toLowerCase()
  );
}

export function linkAllowed(url: string): boolean {
  const normalised = normaliseLink(url);
  if (normalised.startsWith("#")) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalised)?.[1];
  if (!scheme) return false;
  if (scheme === "https") return HTTPS.test(normalised);
  if (["mailto", "tel", "sms"].includes(scheme)) return true;
  return !FORBIDDEN.has(scheme);
}

// Local development serves media over http; devices can never reach these hosts in production.
const LOCAL_HTTP =
  /^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9.-]+\.lvh\.me|[a-z0-9.-]+\.localhost)(:\d+)?(\/|$)/i;

export function resourceAllowed(url: string, image: boolean): boolean {
  const normalised = normaliseLink(url);
  return (
    HTTPS.test(normalised) ||
    // Only against a local API; production refuses it as the server does.
    (config.apiUrl.startsWith("http:") && LOCAL_HTTP.test(normalised)) ||
    (image && /^data:image\//i.test(normalised))
  );
}
