import { vi } from "vitest";
import type { Instance, PlatformAppConfig } from "@/types";
import type { SetupData } from "../useSetupData";
import type { PlatformSignals, SetupSignals } from "../setupRules";

export const instance = {
  id: "i1",
  name: "Segments Demo",
  api_key: "segmen_key",
  hash_id: "hash1",
  uri_scheme: "segmenscheme",
  icon_url: null,
  get_started_dismissed: false,
  production: {
    id: "p1",
    name: "Segments Demo",
    domain: "segdemo.sqd.link",
    hash_id: "ph1",
  },
  test: {
    id: "t1",
    name: "Segments Demo-test",
    domain: "segdemo.test-sqd.link",
    hash_id: "th1",
  },
} as unknown as Instance;

type PlatformData = SetupData["platforms"]["ios"];

const platform = (
  over: Partial<
    PlatformSignals & { config?: PlatformAppConfig; seenAt: string | null }
  > = {}
): PlatformData => ({
  registered: false,
  walked: new Set<string>(),
  seen: false,
  seenAt: null,
  ...over,
});

export const signals = (over: Partial<SetupSignals> = {}): SetupSignals => ({
  domainMarked: false,
  customDomain: false,
  appConnected: false,
  appMarked: false,
  fallbackSet: false,
  hasLinks: false,
  ...over,
});

export function makeData(
  over: Partial<Omit<SetupData, "platforms">> & {
    platforms?: Partial<
      Record<"ios" | "android" | "web", Partial<PlatformData>>
    >;
  } = {}
): SetupData {
  const { platforms = {}, ...rest } = over;
  return {
    loading: false,
    signals: signals(),
    getStarted: undefined,
    hasPaidPlan: false,
    planLoading: false,
    primaryDomain: null,
    customDomainsAvailable: true,
    redirectConfig: undefined,
    hasPurchases: false,
    ...rest,
    platforms: {
      ios: platform(platforms.ios),
      android: platform(platforms.android),
      web: platform(platforms.web),
    },
  };
}

export const iosConfig = (bundle = "io.segments.demo"): PlatformAppConfig => ({
  platform: "ios",
  enabled: true,
  configuration: { bundle_id: bundle, app_prefix: "8K3J2Q9X7P" },
});

export const mutation = (impl?: (...a: unknown[]) => unknown) => ({
  mutateAsync: vi.fn(impl ?? (() => Promise.resolve({ data: {} }))),
  mutate: vi.fn(),
  isPending: false,
});
