import { describe, expect, it } from "vitest";
import {
  buildFormValuesFromServer,
  defaultFormValues,
  desktopRedirectArgs,
  phoneRedirectArgs,
} from "@/lib/redirectRulesForm";
import { intentFiltersXml } from "@/lib/AndroidPageConstants";

const phone = defaultFormValues.ios;

describe("redirect rule payloads", () => {
  it("sends the store when the app is on with the store fallback", () => {
    expect(
      phoneRedirectArgs({ ...phone, enabled: true, appStore: true })
    ).toEqual({
      appstore: true,
      fallbackUrl: null,
      enabled: true,
    });
  });

  it("sends the custom page when the app is on without the store", () => {
    expect(
      phoneRedirectArgs({
        ...phone,
        enabled: true,
        appStore: false,
        customUrl: "https://a.io",
      })
    ).toEqual({ appstore: false, fallbackUrl: "https://a.io", enabled: true });
  });

  it("sends the web page with the app off", () => {
    expect(
      phoneRedirectArgs({ ...phone, enabled: false, customUrl: "https://a.io" })
    ).toEqual({ appstore: false, fallbackUrl: "https://a.io", enabled: false });
  });

  it("sends the Grovs page or a custom page on desktop", () => {
    expect(desktopRedirectArgs({ generatedPage: true, customUrl: "" })).toEqual(
      {
        appstore: true,
        fallbackUrl: null,
        enabled: true,
      }
    );
    expect(
      desktopRedirectArgs({ generatedPage: false, customUrl: "https://a.io" })
    ).toEqual({ appstore: false, fallbackUrl: "https://a.io", enabled: true });
  });

  it("falls back to the defaults without a server config", () => {
    expect(buildFormValuesFromServer(undefined)).toBe(defaultFormValues);
  });
});

describe("intentFiltersXml", () => {
  it("adds the scheme filter, then one verified filter per host", () => {
    const xml = intentFiltersXml("demo", [
      "a.sqd.link",
      "links.a.io",
      "a.test-sqd.link",
    ]);
    expect(xml).toContain('android:scheme="demo" android:host="open"');
    expect(xml.match(/android:autoVerify="true"/g)).toHaveLength(3);
    expect(xml.indexOf("a.sqd.link")).toBeLessThan(xml.indexOf("links.a.io"));
    expect(xml.endsWith("</intent-filter>\n")).toBe(true);
  });
});
