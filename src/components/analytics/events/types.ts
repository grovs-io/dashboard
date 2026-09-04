export type EventCategory =
  | "engagement"
  | "lifecycle"
  | "revenue"
  | "navigation"
  | "system";

export type EventOccurrence = {
  id: string;
  event_type: string;
  event_name: string;
  timestamp: string; // ISO 8601
  user_id: string; // numeric visitor_id, stringified
  /** Visitor UUID (same id the Audience view shows). null = no resolvable visitor. */
  visitor_uuid: string | null;
  /** Numeric visitor id valid for GET /visitors/{id}; prefer over user_id for merged visitors. */
  resolved_visitor_id: number | null;
  session_id: string;
  platform: string;
  app_version: string;
  device_model: string;
  os_version: string;
  country: string;
  city: string;
  category: EventCategory;
  properties: Record<string, string | number | boolean>;
};

export type EventTableRow = Omit<EventOccurrence, "properties">;

export type QueryFilter = {
  id: string;
  field: string;
  value: string;
  operator: "is" | "is_not" | "contains";
  /** Human-readable label when value is an opaque ID (e.g. campaign/link). */
  displayValue?: string;
};

export type EventVolumeBin = {
  time: string;
  label: string;
  count: number;
};
