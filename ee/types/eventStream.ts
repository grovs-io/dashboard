export const EVENT_STREAM_TYPES = [
  "view",
  "open",
  "install",
  "reinstall",
  "app_open",
  "time_spent",
  "reactivation",
  "user_referred",
  "screen_view",
  "custom",
  "purchase",
] as const;
export type StreamEventType = (typeof EVENT_STREAM_TYPES)[number];
export const DEFAULT_STREAM_TYPES = EVENT_STREAM_TYPES.filter(
  (type) => type !== "screen_view" && type !== "time_spent"
);
export type DestinationKind = "webhook" | "s3";
export interface DestinationSettings {
  url?: string;
  bucket?: string;
  region?: string;
  prefix?: string;
  endpoint?: string;
  force_path_style?: boolean;
}
export interface DestinationCredentials {
  headers?: Record<string, string>;
  access_key_id?: string;
  secret_access_key?: string;
}
export interface DestinationInput {
  name: string;
  kind: DestinationKind;
  settings: DestinationSettings;
  credentials?: DestinationCredentials;
  event_types: StreamEventType[];
  batch_size: number;
  concurrency: number;
  include_ip: boolean;
}
export interface EventDestination extends Omit<
  DestinationInput,
  "credentials"
> {
  id: string;
  status: "enabled" | "paused";
  paused_reason: string | null;
  has_credentials: boolean;
  lag_seconds: number | null;
  delivered_count: number;
  last_delivered_at: string | null;
  last_attempt_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
  failing_since: string | null;
  backoff_until: string | null;
  events_cursor_at: string | null;
  purchases_cursor_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface FeedToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  created_by_email: string | null;
}
export interface EventExportInput {
  start_date: string;
  end_date: string;
  destination_id?: string;
}
export interface DestinationResponse {
  event_destination: EventDestination;
  signing_secret?: string | null;
}
export type DestinationAction = "pause" | "resume" | "rewind" | "test";
