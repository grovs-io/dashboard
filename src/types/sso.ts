export interface SsoDomain {
  domain: string;
  verified_at: string | null;
  record_name: string;
  record_value: string;
}

export interface SsoConnection {
  id: number;
  issuer: string;
  client_id: string;
  client_secret_set: boolean;
  client_secret_expires_at: string | null;
  client_secret_expires_soon: boolean;
  domains: SsoDomain[];
  enforce: boolean;
  jit_provision: boolean;
  admin_claim_value: string | null;
  scim: {
    enabled: boolean;
    base_url: string;
    token_set: boolean;
    last_used_at: string | null;
  };
  enabled: boolean;
  active: boolean;
  redirect_uri: string;
  created_at: string;
  updated_at: string;
}

export interface SsoConnectionResponse {
  sso_connection: SsoConnection | null;
  sessions_revoked?: number;
}

export interface SsoConnectionUpsertPayload {
  issuer?: string;
  client_id?: string;
  client_secret?: string;
  client_secret_expires_at?: string | null;
  domains?: string[];
  enforce?: boolean;
  jit_provision?: boolean;
  admin_claim_value?: string | null;
  enabled?: boolean;
}

export interface SsoDiscoverResponse {
  connection_id: number | null;
  enforce?: boolean;
}

/** A 403 body from any password-based auth endpoint on an SSO-enforced domain. */
export interface SsoRefusalBody {
  error: string;
  sso_connection_id: number;
}
