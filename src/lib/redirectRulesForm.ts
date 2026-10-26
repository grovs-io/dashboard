import type { RedirectPlatformConfig } from "@/types";
import type { RedirectRulesFormValues } from "@/schemas/redirect";
import { inAppBrowserPageFromServer } from "@/lib/inAppBrowserSetting";

type PhoneValues = RedirectRulesFormValues["ios"];

export const defaultFormValues: RedirectRulesFormValues = {
  defaultUrl: "",
  android: {
    enabled: false,
    appStore: false,
    customUrl: "",
    showPreview: false,
    copyToClipboard: false,
    inAppBrowserPage: false,
  },
  ios: {
    enabled: false,
    appStore: true,
    customUrl: "",
    showPreview: false,
    copyToClipboard: false,
    inAppBrowserPage: false,
  },
  desktop: {
    generatedPage: true,
    customUrl: "",
  },
};

export function buildFormValuesFromServer(
  config:
    | {
        default_fallback: string;
        show_preview_android: boolean;
        show_preview_ios: boolean;
        copy_to_clipboard_android?: boolean;
        copy_to_clipboard_ios?: boolean;
        in_app_browser_page_android?: boolean;
        in_app_browser_page_ios?: boolean;
        android?: RedirectPlatformConfig;
        ios?: RedirectPlatformConfig;
        desktop?: RedirectPlatformConfig;
      }
    | undefined
): RedirectRulesFormValues {
  if (!config) return defaultFormValues;

  const androidPhone = config.android?.phone;
  const iosPhone = config.ios?.phone;
  const desktopAll = config.desktop?.all;

  return {
    defaultUrl: config.default_fallback || "",
    android: {
      enabled: !!androidPhone?.enabled,
      appStore: !!androidPhone?.appstore,
      customUrl: androidPhone?.fallback_url || "",
      showPreview: !!config.show_preview_android,
      copyToClipboard:
        !!config.show_preview_android && !!config.copy_to_clipboard_android,
      inAppBrowserPage: inAppBrowserPageFromServer(config, "android"),
    },
    ios: {
      enabled: !!iosPhone?.enabled,
      appStore: iosPhone?.appstore != null ? !!iosPhone.appstore : true,
      customUrl: iosPhone?.fallback_url || "",
      showPreview: !!config.show_preview_ios,
      copyToClipboard:
        !!config.show_preview_ios && !!config.copy_to_clipboard_ios,
      inAppBrowserPage: inAppBrowserPageFromServer(config, "ios"),
    },
    desktop: {
      generatedPage:
        desktopAll?.appstore != null ? !!desktopAll.appstore : true,
      customUrl: desktopAll?.fallback_url || "",
    },
  };
}

// App on: store or custom page when not installed; app off: always the custom page.
export function phoneRedirectArgs(values: PhoneValues): {
  appstore: boolean;
  fallbackUrl: string | null;
  enabled: boolean;
} {
  if (values.enabled && values.appStore)
    return { appstore: true, fallbackUrl: null, enabled: true };
  return {
    appstore: false,
    fallbackUrl: values.customUrl,
    enabled: values.enabled,
  };
}

export function desktopRedirectArgs(
  values: RedirectRulesFormValues["desktop"]
): { appstore: boolean; fallbackUrl: string | null; enabled: boolean } {
  if (values.generatedPage)
    return { appstore: true, fallbackUrl: null, enabled: true };
  return {
    appstore: false,
    fallbackUrl: values.customUrl || null,
    enabled: true,
  };
}
