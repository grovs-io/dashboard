import type { AudienceType } from "@ee/types/audience";
import type { Conversion, VariantId } from "@ee/types/experiment";

export type PushStatus =
  | "draft"
  | "scheduled"
  | "evaluating"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export type PushFailureReason =
  | "segment_busy"
  | "segment_invalid"
  | "query_too_heavy"
  | "evaluation_error";

export type PushAudienceType = AudienceType;

export type PushDeliveryStatus =
  | "pending"
  | "claimed"
  | "queued"
  | "delivered"
  | "failed"
  | "no_channel"
  | "not_found"
  | "cancelled"
  | "held"
  | "waiting";

// Dashboard 403 carries no code; the server-to-server API adds one on 403/429 too.
export type PushErrorCode =
  | "rate_limited"
  | "enterprise_required"
  | "segment_busy"
  | "invalid_segment"
  | "query_too_heavy"
  | "clickhouse_unavailable";

export interface PushAudience {
  type: PushAudienceType;
  recipients_count: number;
  // Omitted on list rows (slim serialization); present on GET .../push_campaigns/:id.
  recipients?: string[];
  segment_id: string | null;
  segment_definition_hash: string | null;
}

export interface PushReport {
  targeted: number;
  no_channel: number;
  not_found: number;
  queued: number;
  delivered: number;
  failed: number;
  opened: number;
  cancelled: number;
  // Kept back as a control (the campaign's own or the project's); not in targeted.
  held: number;
  // Outside the test share, still to receive the winner.
  waiting: number;
  error_counts: Record<string, number>;
  audience: {
    persons: number | null;
    devices: number | null;
    incomplete: boolean;
  };
}

// The campaign's own title and body are variant A.
export interface PushVariant {
  id: VariantId;
  title: string;
  body: string;
}

export const WINNER_AFTER_MINUTES = [30, 60, 120, 360, 720, 1440] as const;
export type WinnerAfter = (typeof WINNER_AFTER_MINUTES)[number];
export type WinnerBy = "opens" | "conversions";

export interface PushCampaign {
  id: string;
  name: string;
  title: string;
  body: string;
  image_url: string | null;
  // Read-only: the URL the push will actually carry (image_url, else the uploaded file).
  image: string | null;
  sound: string | null;
  data: Record<string, unknown>;
  link_id: number | null;
  source: "dashboard" | "api";
  status: PushStatus;
  scheduled_at: string | null;
  local_time: boolean;
  timezone: string;
  evaluated_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: PushFailureReason | null;
  audience: PushAudience;
  report: PushReport;
  control_group: number | null;
  conversion: Conversion | null;
  variants: PushVariant[] | null;
  // With variants only: the percent that receives them at once; the rest waits for send_winner.
  test_share: number | null;
  // With a test share: the timer that sends the winner by itself, and what it judges by.
  winner_after_minutes: WinnerAfter | null;
  winner_by: WinnerBy | null;
  // Read-only: when the timer fires; the variant sent to the rest, by hand or by the timer.
  winner_due_at: string | null;
  winner: "a" | VariantId | null;
  created_at: string;
  updated_at: string;
}

// visitor.id is the raw integer id (VisitorSerializer#build does not hashid it); uuid is the addressable id.
export interface PushDeliveryVisitor {
  id: number;
  uuid: string;
  sdk_identifier: string | null;
}

export interface PushDelivery {
  id: number;
  status: PushDeliveryStatus;
  platform: string | null;
  recipient: string | null;
  error: string | null;
  opened_at: string | null;
  visitor: PushDeliveryVisitor | null;
}

export type PushPlatform = "ios" | "android";

export interface PushPlatformReach {
  devices: number | null;
  configured: boolean;
}

export interface PushEstimate {
  devices: number;
  no_channel: number;
  not_found: number;
  // Segment audiences only.
  persons?: number;
  incomplete?: boolean;
  // Absent from older backends; null when a broad segment can't be split by platform.
  no_app?: number | null;
  reachable?: number | null;
  platforms?: Record<PushPlatform, PushPlatformReach>;
}

export interface PushScheduleInput {
  scheduled_at?: string;
  local_time?: boolean;
  timezone?: string;
}

export interface PushAudienceInput {
  type: PushAudienceType;
  recipients?: string[];
  segment_id?: string;
}

export interface PushCampaignInput {
  name?: string;
  title?: string;
  body?: string;
  image_url?: string | null;
  sound?: string | null;
  data?: Record<string, unknown>;
  link_id?: number | null;
  audience?: PushAudienceInput;
  control_group?: number | null;
  conversion?: Conversion | null;
  variants?: PushVariant[] | null;
  test_share?: number | null;
  winner_after_minutes?: WinnerAfter | null;
  winner_by?: WinnerBy | null;
}

export interface PushDeliveriesParams {
  status?: PushDeliveryStatus;
  after?: number;
  limit?: number;
}
