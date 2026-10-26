import { clickRate } from "@ee/lib/inApp";
import type { VariantKey } from "@ee/lib/inAppComposer";
import type { Experiment, ExperimentGroup } from "@ee/types/experiment";

export type Metric = "opens" | "conversions";

export interface VariantRate {
  id: VariantKey;
  rate: number | null;
  group: ExperimentGroup;
}

const isVariant = (
  g: ExperimentGroup
): g is ExperimentGroup & { id: VariantKey } =>
  g.id === "a" || g.id === "b" || g.id === "c";

// The variants in A, B, C order with the rate of the metric.
export function variantRates(
  experiment: Experiment,
  metric: Metric
): VariantRate[] {
  return experiment.groups
    .filter(isVariant)
    .sort((x, y) => x.id.localeCompare(y.id))
    .map((group) => ({
      id: group.id,
      rate: metric === "conversions" ? group.conversion_rate : group.click_rate,
      group,
    }));
}

// Who leads on the metric now; null without data, `tied` when the top two are level.
export function leaderOf(rates: VariantRate[]): {
  leader: VariantRate | null;
  tied: boolean;
} {
  const known = rates.filter((r) => r.rate !== null);
  if (known.length === 0) return { leader: null, tied: false };
  const best = Math.max(...known.map((r) => r.rate!));
  const top = known.filter((r) => r.rate === best);
  return { leader: top[0]!, tied: top.length > 1 };
}

// Mirrors Experiments::Report::MIN_PEOPLE: below it on any variant, the timer sends A.
export const MIN_PEOPLE = 100;

export function underMinPeople(rates: VariantRate[]): boolean {
  return rates.some((r) => r.group.exposed < MIN_PEOPLE);
}

// "B leads: 12.0% vs 4.5%", "A leads: A 5.1%, B 4.0%, C 3.2%", or "B and C are tied; a tie goes to B".
export function leaderSentence(rates: VariantRate[]): string | null {
  const { leader, tied } = leaderOf(rates);
  if (!leader) return null;
  const name = (r: VariantRate) => r.id.toUpperCase();
  if (tied) {
    const level = rates.filter((r) => r.rate === leader.rate).map(name);
    return `${level.join(" and ")} are tied; a tie goes to ${level[0]}`;
  }
  if (rates.length <= 2) {
    const other = rates.find((r) => r.id !== leader.id);
    return `${name(leader)} leads: ${clickRate(leader.rate!)} vs ${other?.rate === null || !other ? "—" : clickRate(other.rate)}`;
  }
  return `${name(leader)} leads: ${rates
    .map((r) => `${name(r)} ${r.rate === null ? "—" : clickRate(r.rate)}`)
    .join(", ")}`;
}
