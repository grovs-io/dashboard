import type {
  GetLinksParams,
  GetCampaignsParams,
  DateRangeQuery,
  GetRevenueParams,
  GetVisitorsParams,
  AnalyticsEventsParams,
  AnalyticsEventVolumeParams,
  AnalyticsFieldValuesParams,
  AnalyticsOverviewParams,
  AnalyticsDateRangeParams,
  OverviewKeyMetricSeriesParams,
  AnalyticsRetentionSummaryParams,
  AuditEventFilters,
  GetSegmentsParams,
  MetricQueryParams,
} from "@/types";
import type {
  EventsSearchPayload,
  EventsSortedPayload,
  LinksByIdsPayload,
  LinksLookupParams,
} from "@/types";

export const queryKeys = {
  projects: {
    eventDestinations: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "eventDestinations"] as const,
    eventStreamTokens: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "eventStreamTokens"] as const,
    all: ["projects"] as const,
    detail: (projectId: string) =>
      [...queryKeys.projects.all, projectId] as const,
    links: (projectId: string, params?: GetLinksParams) =>
      [...queryKeys.projects.detail(projectId), "links", params] as const,
    linksByIds: (projectId: string, ids: LinksByIdsPayload) =>
      [...queryKeys.projects.detail(projectId), "linksByIds", ids] as const,
    linksLookup: (projectId: string, params: LinksLookupParams) =>
      [...queryKeys.projects.detail(projectId), "linksLookup", params] as const,
    linkLastOpen: (projectId: string, linkId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "linkLastOpen",
        linkId,
      ] as const,
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
    segments: (projectId: string, params?: GetSegmentsParams) =>
      [...queryKeys.projects.detail(projectId), "segments", params] as const,
    segment: (projectId: string, segmentId: string) =>
      [...queryKeys.projects.detail(projectId), "segment", segmentId] as const,
    segmentCatalogue: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "segmentCatalogue"] as const,
    segmentCount: (projectId: string, segmentId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "segmentCount",
        segmentId,
      ] as const,
    segmentSizeHistory: (projectId: string, segmentId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "segmentSizeHistory",
        segmentId,
      ] as const,
    segmentBreakdown: (
      projectId: string,
      segmentId: string,
      by: string,
      resultId?: string
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "segmentBreakdown",
        segmentId,
        by,
        resultId,
      ] as const,
    segmentIdentifierListAll: (projectId: string, segmentId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "segmentIdentifierList",
        segmentId,
      ] as const,
    segmentIdentifierList: (projectId: string, segmentId: string, q: string) =>
      [
        ...queryKeys.projects.segmentIdentifierListAll(projectId, segmentId),
        q,
      ] as const,
    segmentMembersAll: (projectId: string, segmentId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "segmentMembers",
        segmentId,
      ] as const,
    segmentMembers: (
      projectId: string,
      segmentId: string,
      resultId?: string,
      q?: string
    ) =>
      [
        ...queryKeys.projects.segmentMembersAll(projectId, segmentId),
        resultId ?? null,
        q ?? "",
      ] as const,
    segmentBreakdownAll: (projectId: string, segmentId: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "segmentBreakdown",
        segmentId,
      ] as const,
    segmentExports: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "segmentExports"] as const,
    pushCampaigns: (projectId: string, params?: { status?: string }) =>
      [
        ...queryKeys.projects.detail(projectId),
        "pushCampaigns",
        params,
      ] as const,
    pushCampaign: (projectId: string, id: string) =>
      [...queryKeys.projects.detail(projectId), "pushCampaign", id] as const,
    pushDeliveries: (projectId: string, id: string, status?: string) =>
      [
        ...queryKeys.projects.detail(projectId),
        "pushDeliveries",
        id,
        status ?? null,
      ] as const,
    pushExperiment: (projectId: string, id: string) =>
      [...queryKeys.projects.detail(projectId), "pushExperiment", id] as const,
    pushDeliveriesAll: (projectId: string, id: string) =>
      [...queryKeys.projects.detail(projectId), "pushDeliveries", id] as const,
    inAppCampaigns: (projectId: string, params?: { status?: string }) =>
      [
        ...queryKeys.projects.detail(projectId),
        "inAppCampaigns",
        params ?? {},
      ] as const,
    inAppCampaign: (projectId: string, id: string) =>
      [...queryKeys.projects.detail(projectId), "inAppCampaign", id] as const,
    inAppReport: (
      projectId: string,
      id: string,
      params: { from: string; to: string; by: string }
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "inAppReport",
        id,
        params,
      ] as const,
    inAppExperiment: (
      projectId: string,
      id: string,
      params: { from: string; to: string }
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "inAppExperiment",
        id,
        params,
      ] as const,
    inAppComments: (
      projectId: string,
      id: string,
      params: { from: string; to: string; values?: string }
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "inAppComments",
        id,
        params,
      ] as const,
    inAppSettings: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "inAppSettings"] as const,
    journeys: (projectId: string, params?: { status?: string }) =>
      [
        ...queryKeys.projects.detail(projectId),
        "journeys",
        params ?? {},
      ] as const,
    journey: (projectId: string, id: string) =>
      [...queryKeys.projects.detail(projectId), "journey", id] as const,
    journeyReport: (
      projectId: string,
      id: string,
      params: { from: string; to: string }
    ) =>
      [
        ...queryKeys.projects.detail(projectId),
        "journeyReport",
        id,
        params,
      ] as const,
    // Outside the detail prefix: a draft save must not re-run the estimate.
    pushAudienceEstimate: (projectId: string, audience: string) =>
      ["pushAudienceEstimate", projectId, audience] as const,
    redirectConfig: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "redirectConfig"] as const,
    domainConfig: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "domainConfig"] as const,
    smartBanners: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "smartBanners"] as const,
    smartBannersStatus: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "smartBannersStatus"] as const,
    smartBanner: (projectId: string, bannerId: number) =>
      [
        ...queryKeys.projects.detail(projectId),
        "smartBanner",
        bannerId,
      ] as const,
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

    analyticsMetricQuery: (projectId: string, params?: MetricQueryParams) =>
      [
        ...queryKeys.projects.detail(projectId),
        "analyticsMetricQuery",
        params,
      ] as const,

    dashboards: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "dashboards"] as const,
    sdkStatus: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "sdkStatus"] as const,
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

  sdkReleases: {
    android: ["sdkReleases", "android"] as const,
  },
} as const;
