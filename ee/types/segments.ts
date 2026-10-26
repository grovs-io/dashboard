export type SegmentOperator = "and" | "or";

export type SegmentWindow =
  | { last_days: number }
  | { from: string; to: string };

export type StringOp = "is" | "is_not" | "contains";

export interface EventFilter {
  field: string;
  op: StringOp;
  value: string;
}

export interface EventCondition {
  type: "event";
  event_type?: string;
  event_name?: string;
  any?: boolean;
  filters?: EventFilter[];
  count?: number;
  window?: SegmentWindow;
  negate?: boolean;
}

export interface DeviceCondition {
  type: "device";
  field: string;
  op: StringOp;
  value: string[];
  mode: "current" | "used";
  window?: SegmentWindow;
}

export interface ProfileCondition {
  type: "profile";
  field: string;
  op: StringOp | "is_set" | "is_not_set";
  value?: string[];
}

export interface FirstSeenCondition {
  type: "first_seen";
  op: "gte" | "lte";
  value: string;
}

export interface IdentifierCondition {
  type: "identifier";
  op: "is_set" | "is_not_set" | "is" | "contains" | "in_list" | "not_in_list";
  value?: string[];
}

export interface AcquisitionCondition {
  type: "acquisition";
  field: "link_id" | "campaign_id" | "tracking_source" | "tracking_medium";
  op: StringOp;
  value: (string | number)[];
  window?: SegmentWindow;
}

export interface PurchaseCondition {
  type: "purchase";
  product_id?: string[];
  purchase_type?: string[];
  store_source?: string[];
  count?: number;
  min_total_usd_cents?: number;
  window?: SegmentWindow;
  negate?: boolean;
}

export type SegmentCondition =
  | EventCondition
  | DeviceCondition
  | ProfileCondition
  | FirstSeenCondition
  | IdentifierCondition
  | AcquisitionCondition
  | PurchaseCondition;

export type SegmentConditionType = SegmentCondition["type"];

export interface SegmentGroup {
  operator: SegmentOperator;
  conditions: SegmentCondition[];
}

export interface SegmentDefinition {
  version: 1;
  operator: SegmentOperator;
  groups: SegmentGroup[];
}

export interface SegmentSize {
  date: string;
  persons: number;
  devices: number;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  definition: SegmentDefinition;
  definition_hash: string;
  archived: boolean;
  has_identifier_list: boolean;
  identifier_list: { count: number | null; updated_at: string | null } | null;
  size: SegmentSize | null;
  created_at: string;
  updated_at: string;
}

export interface SegmentInput {
  name?: string;
  description?: string | null;
  definition?: SegmentDefinition;
  archived?: boolean;
}

export interface SegmentLimits {
  groups: number;
  conditions_per_group: number;
  filters: number;
  values: number;
  value_bytes: number;
  identifier_list: number;
}

export interface EventCatalogueEntry {
  type: "event";
  event_types: string[];
  filter_columns: string[];
  filter_ops: StringOp[];
  property_prefix: string;
  max_window_days: number;
  negatable: boolean;
}

export interface DeviceCatalogueEntry {
  type: "device";
  fields: string[];
  ops: StringOp[];
  modes: ("current" | "used")[];
  current_window_days: number;
  max_window_days: number;
}

export interface ProfileCatalogueEntry {
  type: "profile";
  ops: ProfileCondition["op"][];
  property_prefix: string;
  property_keys: string[];
}

export interface FirstSeenCatalogueEntry {
  type: "first_seen";
  ops: ("gte" | "lte")[];
}

export interface IdentifierCatalogueEntry {
  type: "identifier";
  ops: IdentifierCondition["op"][];
  valueless_ops: IdentifierCondition["op"][];
}

export interface AcquisitionCatalogueEntry {
  type: "acquisition";
  id_fields: string[];
  string_fields: string[];
  max_window_days: number;
}

export interface PurchaseCatalogueEntry {
  type: "purchase";
  enabled: boolean;
  purchase_types: string[];
  max_window_days: number;
  negatable: boolean;
}

export type CatalogueEntry =
  | EventCatalogueEntry
  | DeviceCatalogueEntry
  | ProfileCatalogueEntry
  | FirstSeenCatalogueEntry
  | IdentifierCatalogueEntry
  | AcquisitionCatalogueEntry
  | PurchaseCatalogueEntry;

export interface SegmentCatalogue {
  version: number;
  limits: SegmentLimits;
  conditions: CatalogueEntry[];
}

export interface SegmentEstimate {
  persons: number;
  devices: number;
  approximate: boolean;
  incomplete: boolean;
}

export interface SegmentCount extends Omit<SegmentEstimate, "approximate"> {
  result_id: string;
}

export interface SegmentMember {
  id: string;
  uuid: string;
  sdk_identifier: string | null;
  sdk_attributes: Record<string, unknown> | null;
  inviter_id: string | null;
  web_visitor: boolean;
  created_at: string;
  updated_at: string;
  person_key: string;
}

export interface SegmentMembersPage {
  users: SegmentMember[];
  next_cursor: string | null;
  result_id: string;
  persons: number;
  devices: number;
  incomplete: boolean;
}

export interface SegmentBreakdownBucket {
  value: string;
  label: string;
  persons: number;
}

export interface SegmentBreakdown {
  by: string;
  total_persons: number;
  result_id: string;
  buckets: SegmentBreakdownBucket[];
}

export interface SegmentSizePoint extends SegmentSize {
  incomplete: boolean;
}

export type SegmentExportStatus = "pending" | "ready" | "failed" | "expired";

export interface SegmentExport {
  id: string;
  segment_id: string;
  status: SegmentExportStatus;
  rows: number | null;
  definition_hash: string;
  error: string | null;
  download_url: string | null;
  created_at: string;
  updated_at: string;
}

export type SegmentErrorCode =
  | "segment_busy"
  | "query_too_heavy"
  | "window_expired"
  | "invalid_definition"
  | "result_expired"
  | "upload_in_progress"
  | "clickhouse_unavailable";

export const BREAKDOWN_DIMENSIONS = [
  "platform",
  "country",
  "app_version",
  "source",
  "campaign",
  "first_seen_week",
] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];
