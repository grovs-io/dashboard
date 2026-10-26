import { describe, expect, it } from "vitest";
import { inAppBrowserPageFromServer } from "@/lib/inAppBrowserSetting";

describe("inAppBrowserPageFromServer", () => {
  it("reads each platform independently", () => {
    const config = {
      in_app_browser_page_ios: true,
      in_app_browser_page_android: false,
    };
    expect(inAppBrowserPageFromServer(config, "ios")).toBe(true);
    expect(inAppBrowserPageFromServer(config, "android")).toBe(false);
  });

  it("treats a missing field (older backend) as off", () => {
    expect(inAppBrowserPageFromServer({}, "ios")).toBe(false);
    expect(inAppBrowserPageFromServer(undefined, "android")).toBe(false);
  });
});
