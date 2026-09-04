import type {
  GetLinksParams,
  GetCampaignsParams,
  DateRangeQuery,
  GetRevenueParams,
  GetMessagingParams,
  GetVisitorsParams,
  AnalyticsEventsParams,
  AnalyticsEventVolumeParams,
  AnalyticsFieldValuesParams,
  AnalyticsOverviewParams,
  AnalyticsDateRangeParams,
  OverviewKeyMetricSeriesParams,
  AnalyticsRetentionSummaryParams,
  AuditEventFilters,
} from "@/types";
import type {
  EventsSearchPayload,
  EventsSortedPayload,
  LinksByIdsPayload,
} from "@/types";

export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    detail: (projectId: string) =>
      [...queryKeys.projects.all, projectId] as const,
    links: (projectId: string, params?: GetLinksParams) =>
      [...queryKeys.projects.detail(projectId), "links", params] as const,
    linksByIds: (projectId: string, ids: LinksByIdsPayload) =>
      [...queryKeys.projects.detail(projectId), "linksByIds", ids] as const,
    pathAvailable: (projectId: string, path: string) =>
      [...queryKeys.projects.detail(projectId), "pathAvailable", path] as const,
    randomPath: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "randomPath"] as const,
    campaigns: (projectId: string, params?: GetCampaignsParams) =>
      [...queryKeys.projects.detail(projectId), "campaigns", params] as const,
    campaignMetrics: (projectId: string, params?: DateRangeQuery) =>
      [
        ...queryKeys.projects.detail(projectId),
        "campaignMetrics",
        params,
      ] as const,
    topLinks: (projectId: string, params?: DateRangeQuery) =>
      [...queryKeys.projects.detail(projectId), "topLinks", params] as const,
    linksViews: (projectId: string, params?: DateRangeQuery) =>
      [...queryKeys.projects.detail(projectId), "linksViews", params] as const,
    metricsOverview: (projectId: string, params?: DateRangeQuery) =>
      [
        ...queryKeys.projects.detail(projectId),
        "metricsOverview",
        params,
      ] as const,
    purchases: (projectId: string, params?: GetRevenueParams) =>
      [...queryKeys.projects.detail(projectId), "purchases", params] as const,
    revenueMetrics: (projectId: string, params?: GetRevenueParams) =>
      [
        ...queryKeys.projects.detail(projectId),
        "revenueMetrics",
        params,
      ] as const,
    notifications: (projectId: string, params?: GetMessagingParams) =>
      [
        ...queryKeys.projects.detail(projectId),
        "notifications",
        params,
      ] as const,
    events: (projectId: string, params?: EventsSearchPayload) =>
      [...queryKeys.projects.detail(projectId), "events", params] as const,
    eventsSorted: (projectId: string, params?: EventsSortedPayload) =>
      [
        ...queryKeys.projects.detail(projectId),
        "eventsSorted",
        params,
      ] as const,
    eventsOverview: (projectId: string, params?: DateRangeQuery) =>
      [
        ...queryKeys.projects.detail(projectId),
        "eventsOverview",
        params,
      ] as const,
    eventsPayment: (projectId: string, params?: DateRangeQuery) =>
      [
        ...queryKeys.projects.detail(projectId),
        "eventsPayment",
        params,
      ] as const,
    metricValues: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "metricValues"] as const,
    visitors: (projectId: string, params?: GetVisitorsParams) =>
      [...queryKeys.projects.detail(projectId), "visitors", params] as const,
    aggregatedVisitors: (projectId: string, params?: GetVisitorsParams) =>
      [
        ...queryKeys.projects.detail(projectId),
        "aggregatedVisitors",
        params,
      ] as const,
    visitorDetails: (projectId: string, visitorId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "visitorDetails",
        visitorId,
      ] as const,
    redirectConfig: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "redirectConfig"] as const,
    domainConfig: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "domainConfig"] as const,
    domainDefaults: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "domainDefaults"] as const,
    customDomain: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "customDomain"] as const,
    customDomains: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "customDomains"] as const,
    customDomainPreflight: (projectId: string, hostname: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "customDomainPreflight",
        hostname,
      ] as const,
    migrationSource: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "migrationSource"] as const,

    // Analytics - Events
    analyticsEvents: (projectId: string, params?: AnalyticsEventsParams) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsEvents",
        params,
      ] as const,
    analyticsEventDetail: (projectId: string, eventId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsEventDetail",
        eventId,
      ] as const,
    analyticsEventVolume: (
      projectId: string,
      params?: AnalyticsEventVolumeParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsEventVolume",
        params,
      ] as const,
    analyticsEventFieldValues: (
      projectId: string,
      params?: AnalyticsFieldValuesParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsEventFieldValues",
        params,
      ] as const,
    analyticsEventFields: (projectId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsEventFields",
      ] as const,

    // Analytics - Overview
    analyticsOverviewVersions: (
      projectId: string,
      params?: AnalyticsOverviewParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsOverviewVersions",
        params,
      ] as const,
    analyticsOverviewVersionDistribution: (
      projectId: string,
      params?: AnalyticsOverviewParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsOverviewVersionDistribution",
        params,
      ] as const,
    analyticsOverviewVersionFunnel: (
      projectId: string,
      version: string,
      params?: AnalyticsOverviewParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsOverviewVersionFunnel",
        version,
        params,
      ] as const,
    analyticsOverviewUserTrends: (
      projectId: string,
      params?: AnalyticsOverviewParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsOverviewUserTrends",
        params,
      ] as const,
    analyticsOverviewSourcesBreakdown: (
      projectId: string,
      params?: AnalyticsOverviewParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsOverviewSourcesBreakdown",
        params,
      ] as const,

    analyticsOverviewKeyMetrics: (
      projectId: string,
      params?: AnalyticsDateRangeParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsOverviewKeyMetrics",
        params,
      ] as const,

    analyticsOverviewKeyMetricSeries: (
      projectId: string,
      params?: OverviewKeyMetricSeriesParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsOverviewKeyMetricSeries",
        params,
      ] as const,

    // Analytics - Retention
    analyticsRetentionSummary: (
      projectId: string,
      params?: AnalyticsRetentionSummaryParams
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsRetentionSummary",
        params,
      ] as const,
  },

  instances: {
    all: ["instances"] as const,
    detail: (instanceId: string) =>
      [...queryKeys.instances.all, instanceId] as const,
    members: (instanceId: string) =>
      [...queryKeys.instances.detail(instanceId), "members"] as const,
    config: (instanceId: string) =>
      [...queryKeys.instances.detail(instanceId), "config"] as const,
    userRole: (instanceId: string) =>
      [...queryKeys.instances.detail(instanceId), "userRole"] as const,
    setupProgress: (instanceId: string, category: string) =>
      [
        ...queryKeys.instances.detail(instanceId),
        "setupProgress",
        category,
      ] as const,
    auditHead: (instanceId: string) =>
      [...queryKeys.instances.detail(instanceId), "auditHead"] as const,
    auditEventsAll: (instanceId: string) =>
      [...queryKeys.instances.detail(instanceId), "auditEvents"] as const,
    auditEvents: (instanceId: string, filters?: AuditEventFilters) =>
      [
        ...queryKeys.instances.detail(instanceId),
        "auditEvents",
        filters,
      ] as const,
    auditExportTokens: (instanceId: string) =>
      [...queryKeys.instances.detail(instanceId), "auditExportTokens"] as const,
    ssoConnection: (instanceId: string) =>
      [...queryKeys.instances.detail(instanceId), "ssoConnection"] as const,
  },

  payments: {
    subscription: (instanceId: string) =>
      ["payments", "subscription", instanceId] as const,
    mau: (instanceId: string) => ["payments", "mau", instanceId] as const,
    usage: (instanceId: string) => ["payments", "usage", instanceId] as const,
    dashboardUrl: (instanceId: string) =>
      ["payments", "dashboardUrl", instanceId] as const,
  },

  user: {
    current: ["user", "current"] as const,
    otpEnabled: (email: string) => ["user", "otpEnabled", email] as const,
    otpQrCode: ["user", "otpQrCode"] as const,
  },

  mcp: {
    tokens: ["mcp", "tokens"] as const,
  },
} as const;
