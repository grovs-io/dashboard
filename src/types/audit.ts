export interface AuditActor {
  type: "user" | "admin_key" | "api_key" | "system" | (string & {});
  id: number | string | null;
  email: string | null;
  via: string | null;
}

export interface AuditEvent {
  id: number;
  sequence: number;
  occurred_at: string;
  action: string;
  outcome: string;
  actor: AuditActor;
  target: Record<string, unknown>;
  changes: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  prev_hash: string | null;
  hash: string;
}

export interface AuditEventsResponse {
  schema_version: number;
  events: AuditEvent[];
  next_after: number | null;
  next_before: number | null;
}

export interface AuditHeadResponse {
  schema_version: number;
  sequence: number;
  hash: string | null;
}

export interface AuditEventFilters {
  event_action?: string;
  actor_email?: string;
  from?: string;
  to?: string;
}

export interface AuditEventsParams extends AuditEventFilters {
  order?: "asc" | "desc";
  limit?: number;
  after?: number;
  before?: number;
}

export interface AuditExportToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  created_by_email: string | null;
}

export interface AuditExportTokensResponse {
  audit_export_tokens: AuditExportToken[];
}

export interface AuditExportTokenCreateResponse {
  audit_export_token: AuditExportToken;
  token: string;
}
