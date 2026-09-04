import { DEFAULT } from "@/constants/OptionsConstants";
import type { RedirectURL, RedirectConfig } from "@/types";

export type ResolvedPlatformRedirect = {
  platform: "ios" | "android" | "desktop";
  source: "custom" | "default";
  type: "redirect_web" | "app_or_fallback" | "generated_page";
  url: string;
  showPreview: boolean | null;
  copyToClipboard: boolean;
  appStoreRedirect: boolean;
};

export type ResolvedRedirects = {
  ios: ResolvedPlatformRedirect;
  android: ResolvedPlatformRedirect;
  desktop: ResolvedPlatformRedirect;
  fallbackUrl: string;
};

export type LinkRedirectsInput = {
  androidRedirectURL: RedirectURL | null;
  androidRedirectType: string;
  iosRedirectURL: RedirectURL | null;
  iosRedirectType: string;
  desktopRedirectURL: RedirectURL | null;
  desktopRedirectType: string;
  showPreviewAndroid: boolean | null;
  showPreviewIOS: boolean | null;
  copyToClipboardAndroid: boolean | null;
  copyToClipboardIOS: boolean | null;
};

export function resolveRedirects(
  link: LinkRedirectsInput,
  projectConfig: RedirectConfig | null
): ResolvedRedirects {
  const fallbackUrl = projectConfig?.default_fallback ?? "";

  // The copy only happens on the preview page, so it inherits that gate.
  const iosShowPreview =
    link.showPreviewIOS ?? projectConfig?.show_preview_ios ?? false;
  const androidShowPreview =
    link.showPreviewAndroid ?? projectConfig?.show_preview_android ?? false;
  const iosCopyToClipboard =
    iosShowPreview &&
    (link.copyToClipboardIOS ?? projectConfig?.copy_to_clipboard_ios ?? false);
  const androidCopyToClipboard =
    androidShowPreview &&
    (link.copyToClipboardAndroid ??
      projectConfig?.copy_to_clipboard_android ??
      false);

  const resolveIOS = (): ResolvedPlatformRedirect => {
    if (link.iosRedirectType !== DEFAULT && link.iosRedirectURL) {
      const isAppOrFallback =
        link.iosRedirectURL.open_app_if_installed === true;
      return {
        platform: "ios",
        source: "custom",
        type: isAppOrFallback ? "app_or_fallback" : "redirect_web",
        url: link.iosRedirectURL.url ?? "",
        showPreview: iosShowPreview,
        copyToClipboard: iosCopyToClipboard,
        appStoreRedirect: false,
      };
    }
    const iosConfig = projectConfig?.ios?.phone;
    if (iosConfig?.enabled) {
      return {
        platform: "ios",
        source: "default",
        type: "app_or_fallback",
        url: iosConfig.appstore ? "" : iosConfig.fallback_url || fallbackUrl,
        showPreview: iosShowPreview,
        copyToClipboard: iosCopyToClipboard,
        appStoreRedirect: !!iosConfig.appstore,
      };
    }
    return {
      platform: "ios",
      source: "default",
      type: "redirect_web",
      url: iosConfig?.fallback_url || fallbackUrl,
      showPreview: null,
      copyToClipboard: false,
      appStoreRedirect: false,
    };
  };

  const resolveAndroid = (): ResolvedPlatformRedirect => {
    if (link.androidRedirectType !== DEFAULT && link.androidRedirectURL) {
      const isAppOrFallback =
        link.androidRedirectURL.open_app_if_installed === true;
      return {
        platform: "android",
        source: "custom",
        type: isAppOrFallback ? "app_or_fallback" : "redirect_web",
        url: link.androidRedirectURL.url ?? "",
        showPreview: androidShowPreview,
        copyToClipboard: androidCopyToClipboard,
        appStoreRedirect: false,
      };
    }
    const androidConfig = projectConfig?.android?.phone;
    if (androidConfig?.enabled) {
      return {
        platform: "android",
        source: "default",
        type: "app_or_fallback",
        url: androidConfig.appstore
          ? ""
          : androidConfig.fallback_url || fallbackUrl,
        showPreview: androidShowPreview,
        copyToClipboard: androidCopyToClipboard,
        appStoreRedirect: !!androidConfig.appstore,
      };
    }
    return {
      platform: "android",
      source: "default",
      type: "redirect_web",
      url: androidConfig?.fallback_url || fallbackUrl,
      showPreview: null,
      copyToClipboard: false,
      appStoreRedirect: false,
    };
  };

  const resolveDesktop = (): ResolvedPlatformRedirect => {
    if (link.desktopRedirectType !== DEFAULT && link.desktopRedirectURL) {
      return {
        platform: "desktop",
        source: "custom",
        type: "redirect_web",
        url: link.desktopRedirectURL.url ?? "",
        showPreview: null,
        copyToClipboard: false,
        appStoreRedirect: false,
      };
    }
    const desktopConfig = projectConfig?.desktop?.all;
    if (desktopConfig?.appstore) {
      return {
        platform: "desktop",
        source: "default",
        type: "generated_page",
        url: "",
        showPreview: null,
        copyToClipboard: false,
        appStoreRedirect: true,
      };
    }
    return {
      platform: "desktop",
      source: "default",
      type: "redirect_web",
      url: desktopConfig?.fallback_url || fallbackUrl,
      showPreview: null,
      copyToClipboard: false,
      appStoreRedirect: false,
    };
  };

  return {
    ios: resolveIOS(),
    android: resolveAndroid(),
    desktop: resolveDesktop(),
    fallbackUrl,
  };
}
