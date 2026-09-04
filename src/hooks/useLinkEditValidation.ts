import { FILE, DEFAULT, QUICK_LINK } from "@/constants/OptionsConstants";
import { deepEqual } from "@/lib/utils";
import { hasText, isValidHttpsUrl } from "@/lib/validation";
import isURL from "validator/lib/isURL";
import type { Link, RedirectURL } from "@/types";

export interface LinkEditFormValues {
  name: string;
  path: string;
  linkType: string;
  socialMediaTitle: string;
  socialMediaSubTitle: string;
  imageType: string;
  imageFile: File | null | undefined;
  imageLink: string;
  tagList: string[];
  iOSRedirectURL: RedirectURL | null;
  iOSRedirectType: string;
  androidRedirectURL: RedirectURL | null;
  androidRedirectType: string;
  desktopRedirectURL: RedirectURL | null;
  desktopRedirectType: string;
  showPreviewIOS: boolean | null;
  showPreviewAndroid: boolean | null;
  copyToClipboardIOS: boolean | null;
  copyToClipboardAndroid: boolean | null;
  utmCampaign: string;
  utmMedium: string;
  utmSource: string;
  keyValuePair: { key: string; value: string }[];
  pathAvailable: boolean;
}

function getRedirectUrl(obj: RedirectURL | null | undefined): string | null {
  return obj && hasText(obj.url) ? obj.url : null;
}

// null means "inherit the project default", which is a different state from an
// explicit false — comparing truthiness would hide a switch from one to the other.
function tristateEqual(
  a: boolean | null | undefined,
  b: boolean | null | undefined
): boolean {
  return (a ?? null) === (b ?? null);
}

// The form stores "no redirect" as null, the API may send null or omit the key.
function redirectsEqual(
  a: RedirectURL | null | undefined,
  b: RedirectURL | null | undefined
): boolean {
  return deepEqual(a ?? null, b ?? null);
}

export function hasEditChanges(
  form: LinkEditFormValues,
  selectedLink: Link,
  initialKeyPair: { key: string; value: string }[]
): boolean {
  const isFileType = form.imageType === FILE;
  const socialMediaImageChanged = isFileType
    ? !!form.imageFile
    : (form.imageLink ?? "") !== (selectedLink.image ?? "");

  return (
    (selectedLink.name ?? "") !== (form.name ?? "") ||
    (selectedLink.ads_platform ?? QUICK_LINK) !==
      (form.linkType ?? QUICK_LINK) ||
    (selectedLink.path ?? "") !== (form.path ?? "") ||
    (selectedLink.title ?? "") !== (form.socialMediaTitle ?? "") ||
    (selectedLink.subtitle ?? "") !== (form.socialMediaSubTitle ?? "") ||
    socialMediaImageChanged ||
    !redirectsEqual(
      form.androidRedirectURL,
      selectedLink.android_custom_redirect
    ) ||
    !redirectsEqual(form.iOSRedirectURL, selectedLink.ios_custom_redirect) ||
    !redirectsEqual(
      form.desktopRedirectURL,
      selectedLink.desktop_custom_redirect
    ) ||
    (form.utmCampaign ?? "") !== (selectedLink.tracking_campaign ?? "") ||
    (form.utmMedium ?? "") !== (selectedLink.tracking_medium ?? "") ||
    (form.utmSource ?? "") !== (selectedLink.tracking_source ?? "") ||
    !tristateEqual(selectedLink.show_preview_ios, form.showPreviewIOS) ||
    !tristateEqual(
      selectedLink.show_preview_android,
      form.showPreviewAndroid
    ) ||
    !tristateEqual(
      selectedLink.copy_to_clipboard_ios,
      form.copyToClipboardIOS
    ) ||
    !tristateEqual(
      selectedLink.copy_to_clipboard_android,
      form.copyToClipboardAndroid
    ) ||
    !deepEqual(selectedLink.tags ?? [], form.tagList ?? []) ||
    !deepEqual(initialKeyPair ?? {}, form.keyValuePair ?? {})
  );
}

export function disableEditButton(
  form: LinkEditFormValues,
  selectedLink: Link,
  initialKeyPair: { key: string; value: string }[]
): boolean {
  const isFileType = form.imageType === FILE;
  const imageInputValid = isFileType
    ? true
    : !hasText(form.imageLink) || isURL(form.imageLink!);

  const androidUrlValid =
    form.androidRedirectType === DEFAULT ||
    isValidHttpsUrl(getRedirectUrl(form.androidRedirectURL));
  const iosUrlValid =
    form.iOSRedirectType === DEFAULT ||
    isValidHttpsUrl(getRedirectUrl(form.iOSRedirectURL));
  const desktopUrlValid =
    form.desktopRedirectType === DEFAULT ||
    isValidHttpsUrl(getRedirectUrl(form.desktopRedirectURL));
  const redirectsValid = androidUrlValid && iosUrlValid && desktopUrlValid;

  const pathChanged = (selectedLink.path ?? "") !== (form.path ?? "");

  const hasErrors =
    !imageInputValid || !redirectsValid || (pathChanged && !form.pathAvailable);

  return !hasEditChanges(form, selectedLink, initialKeyPair) || hasErrors;
}

export function getEditFirstErrorSection(
  form: LinkEditFormValues,
  selectedLink: Link
): string {
  const pathChanged = (selectedLink.path ?? "") !== (form.path ?? "");
  if (pathChanged && !form.pathAvailable) return "details";

  const isFileType = form.imageType === FILE;
  const imageInputValid = isFileType
    ? true
    : !hasText(form.imageLink) || isURL(form.imageLink!);
  if (!imageInputValid) return "social_media_preview";

  const androidUrlValid =
    form.androidRedirectType === DEFAULT ||
    isValidHttpsUrl(getRedirectUrl(form.androidRedirectURL));
  const iosUrlValid =
    form.iOSRedirectType === DEFAULT ||
    isValidHttpsUrl(getRedirectUrl(form.iOSRedirectURL));
  const desktopUrlValid =
    form.desktopRedirectType === DEFAULT ||
    isValidHttpsUrl(getRedirectUrl(form.desktopRedirectURL));

  if (!androidUrlValid || !iosUrlValid || !desktopUrlValid) return "redirects";

  return "details";
}
