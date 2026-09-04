export type SankeyNode = {
  name: string;
  displayName: string;
  value: number;
  dropOff?: number;
  category: "entry" | "screen" | "positive" | "negative";
};

export type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

export type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};

export type InsightCard = {
  label: string;
  value: number;
  formattedValue: string;
  conversionRate: number;
  previousRate?: number;
  insight?: string;
};

export type TimelineEntry = {
  id: string;
  date: string;
  message: string;
  type: "positive" | "negative" | "info";
  linkUrl?: string;
};

export type TrendDataPoint = {
  date: string;
  users: number;
  previousUsers: number;
};

export type SourceBreakdown = {
  name: string;
  value: number;
};

export type FunnelStage = {
  label: string;
  users: number;
  /** Conversion rate from the *previous* stage (100 for first stage) */
  rate: number;
};

export type VersionFunnel = {
  version: string;
  releaseDate: string;
  /** Full funnel (All platforms combined) plus per-platform breakdowns */
  funnels: Record<string, FunnelStage[]>; // "all" | "iOS" | "Android" | "Web"
};

export type PlatformVersion = {
  version: string;
  users: number;
};

export type NodeDetail = {
  name: string;
  displayName: string;
  value: number;
  dropOff?: number;
  avgTime?: string;
  conversionRate?: number;
  topProperties: {
    label: string;
    category: string;
    count: number;
    percent: number;
  }[];
  topSources: { name: string; count: number }[];
  topEvents?: { name: string; count: number; percent: number }[];
};
