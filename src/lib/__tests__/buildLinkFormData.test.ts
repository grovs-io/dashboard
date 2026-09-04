import { describe, it, expect } from "vitest";
import { buildLinkFormData } from "../buildLinkFormData";
import type { BuildFormDataParams } from "../buildLinkFormData";
import { LINK } from "@/constants/OptionsConstants";

const baseParams: BuildFormDataParams = {
  name: "Test Link",
  path: "test-link",
  linkType: "default",
  socialMediaTitle: "",
  socialMediaSubTitle: "",
  imageType: LINK,
  imageFile: undefined,
  imageLink: "",
  tagList: [],
  iOSRedirectURL: null,
  androidRedirectURL: null,
  desktopRedirectURL: null,
  showPreviewIOS: null,
  showPreviewAndroid: null,
  copyToClipboardIOS: null,
  copyToClipboardAndroid: null,
  keyValuePair: [],
  utmCampaign: "",
  utmMedium: "",
  utmSource: "",
  mode: "create",
};

describe("buildLinkFormData clipboard flags", () => {
  it("omits both flags when the link inherits the project defaults", () => {
    const formData = buildLinkFormData(baseParams);
    expect(formData.get("copy_to_clipboard_ios")).toBeNull();
    expect(formData.get("copy_to_clipboard_android")).toBeNull();
  });

  it("sends the flags when the link overrides them", () => {
    const formData = buildLinkFormData({
      ...baseParams,
      showPreviewIOS: true,
      copyToClipboardIOS: true,
      showPreviewAndroid: true,
      copyToClipboardAndroid: false,
    });
    expect(formData.get("copy_to_clipboard_ios")).toBe("true");
    expect(formData.get("copy_to_clipboard_android")).toBe("false");
  });

  it("forces false when the link explicitly skips the preview page", () => {
    const formData = buildLinkFormData({
      ...baseParams,
      showPreviewIOS: false,
      copyToClipboardIOS: true,
      showPreviewAndroid: false,
      copyToClipboardAndroid: true,
    });
    expect(formData.get("copy_to_clipboard_ios")).toBe("false");
    expect(formData.get("copy_to_clipboard_android")).toBe("false");
  });

  it("sends the flag when the preview is inherited from the project", () => {
    const formData = buildLinkFormData({
      ...baseParams,
      showPreviewIOS: null,
      copyToClipboardIOS: true,
    });
    expect(formData.get("copy_to_clipboard_ios")).toBe("true");
  });
});
