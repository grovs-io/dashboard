"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  ExternalLink,
  Globe,
  Laptop,
  QrCode,
  Smartphone,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { showGenericError } from "@/lib/Notifications";
import { ANDROID, DESKTOP, IOS, PHONE } from "@/constants/OptionsConstants";
import { Switch } from "@/components/ui/switch";
import { PlatformIcon } from "@/components/analytics/shared";
import { useDomainConfigQuery } from "@/hooks/queries/useConfigurationQueries";
import {
  useSetDefaultRedirectMutation,
  useSetRedirectMutation,
} from "@/hooks/mutations/useConfigurationMutations";
import {
  buildFormValuesFromServer,
  desktopRedirectArgs,
  phoneRedirectArgs,
} from "@/lib/redirectRulesForm";
import type { RedirectRulesFormValues } from "@/schemas/redirect";
import type { Instance, RedirectConfig } from "@/types";
import {
  ChoiceRow,
  ChoiceRows,
  ErrorText,
  FooterSpacer,
  Hint,
  Lead,
  OptionCard,
  PrimaryButton,
  QuietButton,
  Segmented,
  SetupInput,
  StepPage,
  StepTitle,
} from "../../primitives";
import { isHttpsUrl, stripScheme } from "../../setupRules";
import type { SetupData } from "../../useSetupData";
import { RouteMap, type LinksTab } from "./RouteMap";

type Connected = { ios: boolean; android: boolean };

/** Server rules, with defaults that fit what's connected when nothing is saved yet. */
export function initialLinkValues(
  config: RedirectConfig | undefined,
  connected: Connected
): RedirectRulesFormValues {
  const values = buildFormValuesFromServer(config);
  (["ios", "android"] as const).forEach((p) => {
    const saved = config?.[p]?.phone;
    if (!connected[p]) {
      values[p] = { ...values[p], enabled: false };
    } else if (!saved) {
      values[p] = { ...values[p], enabled: true, appStore: true };
    }
  });
  return values;
}

/** Every URL the chosen options need is a valid https URL, and the fallback is set. */
export function linkValuesValid(
  v: RedirectRulesFormValues,
  connected: Connected
): boolean {
  if (!isHttpsUrl(v.defaultUrl)) return false;
  for (const p of ["ios", "android"] as const) {
    const needsUrl = connected[p] && (!v[p].enabled || !v[p].appStore);
    const url = v[p].customUrl;
    if (needsUrl && !isHttpsUrl(url)) return false;
    if (!connected[p] && url && !isHttpsUrl(url)) return false;
  }
  if (!v.desktop.generatedPage && !isHttpsUrl(v.desktop.customUrl))
    return false;
  return true;
}

const UrlField = ({
  value,
  onChange,
  label,
  placeholder,
  showError,
  className,
  onBlur,
}: {
  value: string;
  onChange: (full: string) => void;
  label: string;
  placeholder: string;
  showError?: boolean;
  className?: string;
  onBlur?: () => void;
}) => {
  const valid = isHttpsUrl(value);
  return (
    <div className={className}>
      <SetupInput
        aria-label={label}
        tone="plain"
        prefix="https://"
        value={stripScheme(value)}
        onChange={(v) =>
          onChange(v.trim() ? `https://${stripScheme(v.trim())}` : "")
        }
        onBlur={onBlur}
        placeholder={placeholder}
        valid={valid}
        invalid={showError && !valid}
        className="h-[42px] text-sm"
        inputMode="url"
      />
    </div>
  );
};

const Section = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="border-t border-border py-4 first:border-t-0 first:pt-1">
    <div className="mb-[9px] text-[13.5px] font-medium">{label}</div>
    {children}
  </div>
);

/** Step 3: where links send each platform, plus the required default fallback. */
export const LinksStep = ({
  instance,
  data,
  onBack,
  onNext,
  onConnect,
}: {
  instance: Instance;
  data: SetupData;
  onBack: () => void;
  onNext: () => void;
  onConnect: (platform: "ios" | "android") => void;
}) => {
  const prod = instance.production;
  const queryClient = useQueryClient();
  const { data: domain } = useDomainConfigQuery(prod?.id);
  const setDefault = useSetDefaultRedirectMutation(prod?.id);
  const setRedirect = useSetRedirectMutation(prod?.id);
  const connected: Connected = {
    ios: data.platforms.ios.registered,
    android: data.platforms.android.registered,
  };
  const [values, setValues] = useState<RedirectRulesFormValues>(() =>
    initialLinkValues(data.redirectConfig, connected)
  );
  const seeded = useRef(!!data.redirectConfig);
  useEffect(() => {
    if (seeded.current || !data.redirectConfig) return;
    seeded.current = true;
    setValues(initialLinkValues(data.redirectConfig, connected));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, [data.redirectConfig]);

  const [tab, setTab] = useState<LinksTab>(
    connected.ios || !connected.android ? "ios" : "android"
  );
  const [advanced, setAdvanced] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const name = prod?.name ?? instance.name;
  const host = domain ? `${domain.subdomain}.${domain.domain}` : "your.link";
  const valid = linkValuesValid(values, connected);
  const fallbackMissing = !isHttpsUrl(values.defaultUrl);

  const setPhone = (
    p: "ios" | "android",
    patch: Partial<RedirectRulesFormValues["ios"]>
  ) => setValues((v) => ({ ...v, [p]: { ...v[p], ...patch } }));

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      await setDefault.mutateAsync({
        defaultFallback: values.defaultUrl,
        showAndroidPreview: values.android.showPreview,
        showIosPreview: values.ios.showPreview,
        copyToClipboardAndroid:
          values.android.showPreview && values.android.copyToClipboard,
        copyToClipboardIos:
          values.ios.showPreview && values.ios.copyToClipboard,
        inAppBrowserPageAndroid: values.android.inAppBrowserPage,
        inAppBrowserPageIos: values.ios.inAppBrowserPage,
      });
      for (const [p, name] of [
        ["ios", IOS],
        ["android", ANDROID],
      ] as const) {
        const args = phoneRedirectArgs(values[p]);
        await setRedirect.mutateAsync({
          platform: name,
          variation: PHONE,
          ...args,
        });
      }
      await setRedirect.mutateAsync({
        platform: DESKTOP,
        variation: DESKTOP,
        ...desktopRedirectArgs(values.desktop),
      });
      if (prod?.id)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.projects.redirectConfig(prod.id),
        });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.instances.detail(instance.id),
      });
      onNext();
    } catch {
      showGenericError();
    } finally {
      setSaving(false);
    }
  };

  const mobile = (p: "ios" | "android") => {
    const v = values[p];
    const store = p === "ios" ? "App Store" : "Google Play";
    const label = p === "ios" ? "iOS" : "Android";
    if (!connected[p]) {
      return (
        <Section label={`On ${label}`}>
          <ChoiceRows>
            <ChoiceRow
              selected
              onSelect={() => {}}
              title="Custom page"
              subtitle="Your own landing page"
            >
              <UrlField
                label={`${label} page`}
                value={v.customUrl}
                onChange={(customUrl) => setPhone(p, { customUrl })}
                placeholder={`company.com/${p}`}
                showError={touched && !!v.customUrl}
              />
              {!v.customUrl && (
                <Hint className="mb-0">Empty uses the fallback below.</Hint>
              )}
            </ChoiceRow>
            <ChoiceRow
              selected={false}
              disabled
              onSelect={() => {}}
              title={store}
              subtitle={`Available once the ${label} app is connected`}
              aside={
                <button
                  type="button"
                  onClick={() => onConnect(p)}
                  className="font-medium text-chart-users hover:text-[var(--chart-users-hover)]"
                >
                  Connect {label}
                </button>
              }
            />
          </ChoiceRows>
        </Section>
      );
    }
    return (
      <>
        <Section label={`If ${name} is installed`}>
          <div role="radiogroup" className="grid gap-2.5 sm:grid-cols-2">
            <OptionCard
              selected={v.enabled}
              onSelect={() => setPhone(p, { enabled: true })}
              icon={<Smartphone />}
              title="Open the app"
              description="On the screen from the link"
            />
            <OptionCard
              selected={!v.enabled}
              onSelect={() => setPhone(p, { enabled: false })}
              icon={<Globe />}
              title="Open a web page"
              description="Skip the app for links"
            />
          </div>
          {!v.enabled && (
            <UrlField
              className="mt-2.5"
              label={`${label} web page`}
              value={v.customUrl}
              onChange={(customUrl) => setPhone(p, { customUrl })}
              placeholder="company.com/app"
              showError={touched}
            />
          )}
        </Section>
        {v.enabled && (
          <Section label="If it isn't installed">
            <div role="radiogroup" className="grid gap-2.5 sm:grid-cols-2">
              <OptionCard
                selected={v.appStore}
                onSelect={() => setPhone(p, { appStore: true })}
                icon={<Store />}
                title={store}
                description="Then open the right screen"
              />
              <OptionCard
                selected={!v.appStore}
                onSelect={() => setPhone(p, { appStore: false })}
                icon={<ExternalLink />}
                title="Custom page"
                description="Your own landing page"
              />
            </div>
            {!v.appStore && (
              <UrlField
                className="mt-2.5"
                label={`${label} landing page`}
                value={v.customUrl}
                onChange={(customUrl) => setPhone(p, { customUrl })}
                placeholder="company.com/download"
                showError={touched}
              />
            )}
          </Section>
        )}
        <div className="border-t border-border">
          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((a) => !a)}
            className="flex w-full items-center gap-2 py-3.5 text-left text-[13.5px] text-foreground/80"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                advanced && "rotate-90"
              )}
            />
            Advanced
            <span className="ml-auto hidden truncate text-[12.5px] text-muted-foreground sm:inline">
              Preview page {v.showPreview ? "on" : "off"} · Social app browsers:{" "}
              {v.inAppBrowserPage ? "open-in-app page" : "go straight through"}
            </span>
          </button>
          {advanced && (
            <div className="flex flex-col gap-3 pb-4 pl-[22px] text-[13.5px]">
              <label className="flex items-start justify-between gap-4">
                <span>
                  Preview page
                  <small className="block text-[12.5px] text-muted-foreground">
                    Shows the link&apos;s title and image before going to the
                    store.
                  </small>
                </span>
                <Switch
                  checked={v.showPreview}
                  onCheckedChange={(showPreview) =>
                    setPhone(p, { showPreview })
                  }
                  aria-label="Preview page"
                />
              </label>
              <label className="flex items-start justify-between gap-4">
                <span>
                  Social app browsers
                  <small className="block text-[12.5px] text-muted-foreground">
                    Inside Instagram, Facebook or TikTok, show a page that opens
                    the app.
                  </small>
                </span>
                <Switch
                  checked={v.inAppBrowserPage}
                  onCheckedChange={(inAppBrowserPage) =>
                    setPhone(p, { inAppBrowserPage })
                  }
                  aria-label="Social app browsers"
                />
              </label>
            </div>
          )}
        </div>
      </>
    );
  };

  const computers = (
    <Section label="On a computer">
      <div role="radiogroup" className="grid gap-2.5 sm:grid-cols-2">
        <OptionCard
          selected={values.desktop.generatedPage}
          onSelect={() =>
            setValues((v) => ({
              ...v,
              desktop: { ...v.desktop, generatedPage: true },
            }))
          }
          icon={<QrCode />}
          title="Grovs page"
          description="QR code and download links"
        />
        <OptionCard
          selected={!values.desktop.generatedPage}
          onSelect={() =>
            setValues((v) => ({
              ...v,
              desktop: { ...v.desktop, generatedPage: false },
            }))
          }
          icon={<ExternalLink />}
          title="Custom page"
          description="Your website"
        />
      </div>
      {!values.desktop.generatedPage && (
        <UrlField
          className="mt-2.5"
          label="Computer page"
          value={values.desktop.customUrl}
          onChange={(customUrl) =>
            setValues((v) => ({ ...v, desktop: { ...v.desktop, customUrl } }))
          }
          placeholder="company.com"
          showError={touched}
        />
      )}
    </Section>
  );

  const left = (
    <>
      <StepTitle>Where should links go?</StepTitle>
      <Lead>Defaults are already set; change only what you need.</Lead>
      <Segmented
        label="Platform"
        value={tab}
        onChange={setTab}
        className="mb-2.5"
        options={[
          {
            value: "ios",
            label: "iOS",
            icon: <PlatformIcon platform="ios" alt="" />,
            extra: !connected.ios && (
              <span className="text-[11.5px] font-normal text-amber-700 dark:text-amber-400">
                Not connected
              </span>
            ),
          },
          {
            value: "android",
            label: "Android",
            icon: <PlatformIcon platform="android" alt="" />,
            extra: !connected.android && (
              <span className="text-[11.5px] font-normal text-amber-700 dark:text-amber-400">
                Not connected
              </span>
            ),
          },
          {
            value: "desktop",
            label: "Computers",
            icon: <Laptop className="size-3.5" />,
          },
        ]}
      />
      <div className="max-w-[620px]">
        {tab === "desktop" ? computers : mobile(tab)}
      </div>
      <div className="mt-1.5 w-full max-w-[620px] border-t border-border pt-4">
        <div className="mb-[3px] text-[13.5px] font-medium">
          Everything else{" "}
          <span className="text-[12.5px] font-normal text-muted-foreground">
            · Default fallback
          </span>
        </div>
        <Hint className="mt-0 mb-[9px]">
          For any device without a rule above, like a TV or a link preview bot.
          Required.
        </Hint>
        <UrlField
          label="Default fallback"
          value={values.defaultUrl}
          onChange={(defaultUrl) => setValues((v) => ({ ...v, defaultUrl }))}
          onBlur={() => setTouched(true)}
          placeholder="company.com"
          showError={touched}
        />
        {touched && fallbackMissing && (
          <ErrorText>
            {values.defaultUrl
              ? "Enter a full https:// address."
              : "Add a fallback URL to continue."}
          </ErrorText>
        )}
      </div>
    </>
  );

  return (
    <StepPage
      left={left}
      right={
        <RouteMap
          values={values}
          tab={tab}
          host={host}
          projectName={name}
          connected={connected}
        />
      }
      footer={
        <>
          {fallbackMissing && (
            <span className="hidden text-[13.5px] text-muted-foreground sm:inline">
              Add a fallback URL to continue
            </span>
          )}
          <FooterSpacer />
          <QuietButton onClick={onBack} className="hidden sm:inline-flex">
            Back
          </QuietButton>
          <PrimaryButton disabled={!valid || saving} onClick={save}>
            Continue
          </PrimaryButton>
        </>
      }
    />
  );
};
