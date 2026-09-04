export interface AuditActionGroup {
  label: string;
  actions: string[];
}

export const AUDIT_ACTION_GROUPS: AuditActionGroup[] = [
  {
    label: "Auth",
    actions: [
      "user.login",
      "user.login_failed",
      "user.logout",
      "user.sso_login",
      "user.password_reset_requested",
      "user.password_changed",
      "user.2fa_enabled",
      "user.2fa_disabled",
      "user.invite_accepted",
      "user.account_deleted",
    ],
  },
  {
    label: "Membership",
    actions: ["instance.member_added", "instance.member_removed"],
  },
  {
    label: "Tenant",
    actions: [
      "instance.renamed",
      "instance.revenue_collection_changed",
      "instance.retention_changed",
      "instance.deletion_requested",
      "instance.deleted",
    ],
  },
  {
    label: "Credentials",
    actions: [
      "mcp_token.revoked",
      "audit_export_token.created",
      "audit_export_token.revoked",
      "api_key.used",
      "api_key.auth_failed",
    ],
  },
  {
    label: "Config",
    actions: [
      "ios_configuration.updated",
      "ios_configuration.removed",
      "ios_push_configuration.updated",
      "ios_api_access_key.updated",
      "android_configuration.updated",
      "android_configuration.removed",
      "android_push_configuration.updated",
      "android_api_access_key.updated",
      "desktop_configuration.updated",
      "desktop_configuration.removed",
      "web_configuration.updated",
      "web_configuration.removed",
      "redirect_config.updated",
      "redirect.updated",
      "domain.updated",
      "domain.google_tracking_id_updated",
    ],
  },
  {
    label: "Custom domains / migration",
    actions: [
      "custom_domain.created",
      "custom_domain.deleted",
      "custom_domain.verified",
      "custom_domain.torn_down",
      "migration_source.created",
      "migration_source.updated",
      "migration_source.deleted",
    ],
  },
  {
    label: "Data",
    actions: [
      "link.created",
      "link.updated",
      "link.deleted",
      "export.link_data",
      "export.usage_data",
      "links.firebase_imported",
    ],
  },
  {
    label: "Billing",
    actions: [
      "enterprise_subscription.created",
      "enterprise_subscription.updated",
      "subscription.changed",
    ],
  },
  {
    label: "System",
    actions: ["retention.deletion_ran", "quota.disabled", "quota.restored"],
  },
];

// Raw string for now; unknown actions from newer backends still render.
export function formatAuditAction(action: string): string {
  return action;
}
