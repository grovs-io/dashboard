type InAppBrowserFields = {
  in_app_browser_page_ios?: boolean;
  in_app_browser_page_android?: boolean;
};

export function inAppBrowserPageFromServer(
  config: InAppBrowserFields | undefined,
  platform: "ios" | "android"
): boolean {
  return platform === "ios"
    ? !!config?.in_app_browser_page_ios
    : !!config?.in_app_browser_page_android;
}
