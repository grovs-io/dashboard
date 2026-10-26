import { z } from "zod";
import { ApiError } from "@/lib/ApiError";
import {
  EVENT_STREAM_TYPES,
  type DestinationInput,
  type EventDestination,
  type EventExportInput,
} from "@ee/types/eventStream";

const DAY = 86_400_000;
const destinationSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(255),
  kind: z.enum(["webhook", "s3"]),
  event_types: z
    .array(z.enum(EVENT_STREAM_TYPES))
    .min(1, "Select at least one event type."),
  batch_size: z.number().int().min(1).max(500),
  concurrency: z.number().int().min(1).max(16),
  include_ip: z.boolean(),
});

function httpsUrl(value: string, label: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname &&
      !url.username &&
      !url.password
    )
      return value;
  } catch {
    /* Report a field-specific error below. */
  }
  throw new Error(
    `${label} must be a public HTTPS URL without embedded credentials.`
  );
}

/** Form boundary: secrets are omitted unless explicitly replaced, never merged. */
export function destinationInput(
  form: FormData,
  existing: EventDestination | undefined,
  selfHosted: boolean
): DestinationInput {
  const value = (name: string) => String(form.get(name) ?? "");
  const kind = existing?.kind ?? value("kind");
  const parsed = destinationSchema.safeParse({
    name: value("name"),
    kind,
    event_types: form.getAll("event_types"),
    batch_size:
      kind === "s3"
        ? (existing?.batch_size ?? 100)
        : Number(value("batch_size")),
    concurrency:
      kind === "s3"
        ? (existing?.concurrency ?? 4)
        : Number(value("concurrency")),
    include_ip: form.has("include_ip"),
  });
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? "Check the destination fields."
    );
  const data: DestinationInput = { ...parsed.data, settings: {} };
  const mode = existing ? value("credential_mode") : "replace";
  if (mode === "clear" && !form.has("confirm_clear"))
    throw new Error("Confirm clearing the stored credentials.");
  if (data.kind === "webhook") {
    data.settings = { url: httpsUrl(value("url").trim(), "Webhook URL") };
    if (mode === "replace") {
      const names = form.getAll("header_name").map(String);
      const values = form.getAll("header_value").map(String);
      const pairs: [string, string][] = [];
      const seen = new Set<string>();
      names.forEach((raw, index) => {
        const name = raw.trim();
        const headerValue = values[index] ?? "";
        if (!name && !headerValue) return;
        if (
          !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) ||
          /[\r\n]/.test(headerValue)
        )
          throw new Error("Enter valid header names and single-line values.");
        if (seen.has(name.toLowerCase()))
          throw new Error("Header names must be unique.");
        seen.add(name.toLowerCase());
        pairs.push([name, headerValue]);
      });
      if (existing?.has_credentials && pairs.length === 0)
        throw new Error(
          "Choose Clear credentials to remove all stored headers."
        );
      data.credentials = { headers: Object.fromEntries(pairs) };
    }
  } else {
    const bucket = value("bucket").trim();
    const region = value("region").trim();
    if (!bucket || !region) throw new Error("Bucket and region are required.");
    const endpoint = value("endpoint").trim();
    if (endpoint && !selfHosted) httpsUrl(endpoint, "S3 endpoint");
    data.settings = {
      bucket,
      region,
      prefix: value("prefix").trim(),
      endpoint,
      force_path_style: form.has("force_path_style"),
    };
    if (mode === "replace") {
      const accessKey = value("access_key_id").trim();
      const secretKey = value("secret_access_key");
      if ((!selfHosted || accessKey || secretKey) && (!accessKey || !secretKey))
        throw new Error("Enter both the access key ID and secret access key.");
      if (existing?.has_credentials && !accessKey)
        throw new Error(
          "Choose Clear credentials to switch to ambient credentials."
        );
      data.credentials = accessKey
        ? { access_key_id: accessKey, secret_access_key: secretKey }
        : {};
    }
    if (mode === "clear" && !selfHosted)
      throw new Error("S3 credentials are required on Grovs Cloud.");
  }
  if (mode === "clear") data.credentials = {};
  return data;
}

export function replayTimestamp(value: string, now = Date.now()): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || time > now || time < now - 7 * DAY)
    throw new Error(
      "Choose a time within the last seven days, not in the future."
    );
  return new Date(time).toISOString();
}

export function exportInput(
  start: string,
  end: string,
  destinationId?: string
): EventExportInput {
  const date = (value: string) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== value
    )
      throw new Error("Enter valid start and end dates.");
    return time;
  };
  const span = date(end) - date(start);
  if (span < 0) throw new Error("End date must be on or after start date.");
  if (span >= 92 * DAY)
    throw new Error("Choose a range of at most 92 days, including both dates.");
  return {
    start_date: start,
    end_date: end,
    ...(destinationId ? { destination_id: destinationId } : {}),
  };
}

export function streamError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "retention_window_exceeded")
      return "This range starts before your plan's retained history. Choose a more recent start date.";
    if (
      error.data &&
      typeof error.data === "object" &&
      "error" in error.data &&
      typeof error.data.error === "string"
    )
      return error.data.error;
    if (error.status === 503)
      return "Requests are temporarily unavailable or throttled. Wait before trying again.";
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "The request failed. Please try again.";
}

export function destinationStatus(destination: EventDestination): string {
  if (destination.status === "paused")
    return destination.paused_reason?.startsWith("auto:")
      ? "Paused after failures"
      : "Paused";
  return destination.consecutive_failures > 0 ? "Retrying" : "Active";
}
export const streamDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Never";
export function streamLag(seconds: number | null) {
  if (seconds === null) return "Not available";
  if (seconds < 60) return `${Math.max(0, seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
