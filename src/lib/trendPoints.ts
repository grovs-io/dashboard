import type { TrendChartPoint } from "@/components/analytics/overview/types";
import type { TrendDatum } from "@/components/analytics/overview/TrendAreaChart";
import type { TrendPoint } from "@/types";

/** /overview/trends/users points as the Overview chart consumes them. */
export function toTrendChartPoints(points: TrendPoint[]): TrendChartPoint[] {
  return points.map((p) => ({
    date: p.date,
    users: p.new_users ?? p.users ?? 0,
    previousUsers: p.previous_new_users ?? p.previous_users ?? 0,
    revenue:
      p.revenue_usd_cents != null ? p.revenue_usd_cents / 100 : undefined,
  }));
}

export function newUsersSeries(trends: TrendChartPoint[]): TrendDatum[] {
  return trends.map((p) => ({
    date: p.date,
    value: p.users,
    previous: p.previousUsers,
  }));
}
