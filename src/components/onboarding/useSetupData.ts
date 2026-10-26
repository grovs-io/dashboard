"use client";

import { useMemo } from "react";
import { hasPaidPlan as isPaidPlan } from "@/lib/plan";
import { ANDROID, IOS, WEB } from "@/constants/OptionsConstants";
import { useSdkStatusQuery } from "@/hooks/queries/useSdkStatusQuery";
import {
  useInstanceConfigQuery,
  useInstanceDetailsQuery,
  useSetupProgressQuery,
} from "@/hooks/queries/useInstanceQueries";
import {
  useCustomDomainsQuery,
  useRedirectConfigQuery,
} from "@/hooks/queries/useConfigurationQueries";
import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import type { Instance, PlatformAppConfig, SdkStatus } from "@/types";
import {
  APP_CONNECTED_STEP,
  LINK_DOMAIN_STEP,
  ONBOARDING_CATEGORY,
  SETUP_CATEGORY,
  type Platform,
  type PlatformSignals,
  type SetupSignals,
} from "./setupRules";

const SDK_POLL_MS = 4000;

type StepsResponse = { steps?: { step_identifier: string }[] } | undefined;

const walkedSet = (data: StepsResponse) =>
  new Set((data?.steps ?? []).map((s) => s.step_identifier));

const PLATFORM_NAME: Record<Platform, string> = {
  ios: IOS,
  android: ANDROID,
  web: WEB,
};

const isRegistered = (platform: Platform, config?: PlatformAppConfig) => {
  const cfg = config?.configuration;
  if (platform === "ios") return !!cfg?.bundle_id;
  if (platform === "android") return !!cfg?.identifier;
  return (cfg?.domains?.length ?? 0) > 0;
};

const seenAt = (platform: Platform, status?: SdkStatus) =>
  status?.[`${platform}_seen_at` as const] ?? null;

/** Everything the setup reads, from the production project unless noted. */
export function useSetupData(instance: Instance | null, pollSdk = false) {
  const instanceId = instance?.id;
  const prodId = instance?.production?.id;
  const testId = instance?.test?.id;

  const details = useInstanceDetailsQuery(instanceId);
  const config = useInstanceConfigQuery(instanceId);
  const onboarding = useSetupProgressQuery(instanceId, ONBOARDING_CATEGORY);
  const iosSteps = useSetupProgressQuery(instanceId, SETUP_CATEGORY.ios);
  const androidSteps = useSetupProgressQuery(
    instanceId,
    SETUP_CATEGORY.android
  );
  const webSteps = useSetupProgressQuery(instanceId, SETUP_CATEGORY.web);
  // The test SDK environment reports to the test project.
  const refetchInterval = pollSdk ? SDK_POLL_MS : false;
  const statusProd = useSdkStatusQuery(prodId, null, { refetchInterval });
  const statusTest = useSdkStatusQuery(testId, null, { refetchInterval });
  const customDomains = useCustomDomainsQuery(prodId);
  const redirect = useRedirectConfigQuery(prodId);
  const subscription = useSubscriptionQuery(instanceId);

  const getStarted = details.data?.get_started_setup;
  const sub = subscription.data?.subscription;
  const hasPaidPlan = isPaidPlan(sub);
  const primaryDomain =
    customDomains.data?.find((d) => d.purpose === "primary") ?? null;

  const platforms = useMemo(() => {
    const walked: Record<Platform, StepsResponse> = {
      ios: iosSteps.data,
      android: androidSteps.data,
      web: webSteps.data,
    };
    const result = {} as Record<
      Platform,
      PlatformSignals & { config?: PlatformAppConfig; seenAt: string | null }
    >;
    (["ios", "android", "web"] as Platform[]).forEach((platform) => {
      const cfg = config.data?.find(
        (c: PlatformAppConfig) => c.platform === PLATFORM_NAME[platform]
      );
      const at =
        seenAt(platform, statusProd.data) ?? seenAt(platform, statusTest.data);
      result[platform] = {
        registered: isRegistered(platform, cfg),
        walked: walkedSet(walked[platform]),
        seen: !!at,
        seenAt: at,
        config: cfg,
      };
    });
    return result;
  }, [
    config.data,
    iosSteps.data,
    androidSteps.data,
    webSteps.data,
    statusProd.data,
    statusTest.data,
  ]);

  const onboardingSteps = walkedSet(onboarding.data);
  const signals: SetupSignals = {
    domainMarked: onboardingSteps.has(LINK_DOMAIN_STEP),
    customDomain: !!primaryDomain,
    appConnected: Object.values(platforms).some((p) => p.seen),
    appMarked: onboardingSteps.has(APP_CONNECTED_STEP),
    fallbackSet: !!getStarted?.redirect_fallback,
    hasLinks: !!getStarted?.has_created_links,
  };

  const loading =
    !instance ||
    details.isLoading ||
    config.isLoading ||
    onboarding.isLoading ||
    (statusProd.isLoading && !statusProd.isError) ||
    (statusTest.isLoading && !statusTest.isError) ||
    customDomains.isLoading ||
    redirect.isLoading;

  return {
    loading,
    signals,
    platforms,
    getStarted,
    hasPaidPlan,
    planLoading: subscription.isLoading,
    primaryDomain,
    customDomainsAvailable: !customDomains.isError,
    redirectConfig: redirect.data,
    hasPurchases: !!statusProd.data?.has_purchases,
  };
}

export type SetupData = ReturnType<typeof useSetupData>;
