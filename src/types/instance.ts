export type AnalyticsPlan = "free" | "paid" | "enterprise" | "self_hosted";

/** Plans with full retention and no upgrade path to sell. */
export function isUnlimitedRetentionPlan(plan: AnalyticsPlan): boolean {
  return plan === "enterprise" || plan === "self_hosted";
}

/**
 * Plan-driven analytics retention window, surfaced on the instance payload so
 * the FE can bound date pickers proactively instead of waiting for the backend
 * to reject an out-of-range query.
 */
export interface AnalyticsRetention {
  plan: AnalyticsPlan;
  /** How far back analytics can be queried, in days. */
  queryable_days: number;
  /** Data older than this is "cold" — heavy query shapes are restricted. */
  cold_after_days: number;
  /** Whether heavy queries are allowed in the cold window. */
  can_query_cold: boolean;
}

export interface Instance {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
  revenue_collection_enabled: boolean;
  get_started_dismissed: boolean;
  projects: Project[];
  api_key: string;
  hash_id: string;
  uri_scheme: string;
  production: Project;
  test: Project;
  // Optional: absent on older backend deploys / self-hosted; treat missing as
  // "unbounded" rather than gating the UI.
  analytics_retention?: AnalyticsRetention;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  hash_id?: string;
  bundle_id?: string;
  team_id?: string;
  app_store_id?: string;
  play_store_id?: string;
  package_name?: string;
  sha256_cert_fingerprints?: string;
}

export interface GetStartedSetup {
  android_sdk: boolean;
  ios_sdk: boolean;
  web_sdk: boolean;
  has_created_campaigns: boolean;
  has_created_links: boolean;
  redirect_fallback: boolean;
}

export interface InstanceMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface PlatformAppConfig {
  platform: string;
  bundle_id?: string;
  team_id?: string;
  app_store_id?: string;
  package_name?: string;
  sha256_cert_fingerprints?: string;
  push_enabled?: boolean;
  enabled?: boolean;
  domains?: string[];
  fallback_url?: string;
  configuration?: {
    identifier?: string;
    bundle_id?: string;
    app_prefix?: string;
    sha256s?: string[];
    domains?: string[];
    push_configuration?: {
      firebase_project_id?: string;
      certificate?: string;
      configured?: boolean;
      [key: string]: unknown;
    };
    server_api_key?: {
      file?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type InstanceConfig = PlatformAppConfig[];
