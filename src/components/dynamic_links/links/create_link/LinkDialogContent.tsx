"use client";

import React from "react";
import CreateLinkSidebar from "./CreateLinkSidebar";
import CreateLinkDetailsSection from "./CreateLinkDetailsSection";
import CreateLinkSocialMediaPreview from "./CreateLinkSocialMediaPreview";
import CreateLinkDataSection from "./CreateLinkDataSection";
import CreateLinksRedirectsSection from "./CreateLinksRedirectsSection";
import CreateLinkTrackingSection from "./CreateLinkTrackingSection";
import type { useCreateLinkForm } from "@/hooks/useCreateLinkForm";
import type { RedirectConfig } from "@/types";

interface LinkDialogContentProps {
  sections: { text: string; value: string; checked: string }[];
  section: string;
  setSection: (section: string) => void;
  disabledActions: boolean;
  showErrors: boolean;
  form: ReturnType<typeof useCreateLinkForm>;
  domain: string;
  projectRedirectsConfig: RedirectConfig | null;
}

const SECTION_META: Record<string, { title: string; description: string }> = {
  details: {
    title: "Details",
    description: "The core information that identifies your link.",
  },
  social_media_preview: {
    title: "Social Media Preview",
    description: "Control how your link looks when shared on social platforms.",
  },
  data: {
    title: "Data",
    description:
      "Attach custom key–value pairs delivered to your app alongside the link.",
  },
  redirects: {
    title: "Redirects",
    description:
      "Choose where each platform sends users when they open the link.",
  },
  tracking: {
    title: "Tracking",
    description: "UTM parameters appended to your redirect URLs for analytics.",
  },
};

const LinkDialogContent: React.FC<LinkDialogContentProps> = ({
  sections,
  section,
  setSection,
  disabledActions,
  showErrors,
  form,
  domain,
  projectRedirectsConfig,
}) => {
  const meta = SECTION_META[section] ?? SECTION_META.details!;
  return (
    <div className="flex h-full w-full overflow-hidden">
      <CreateLinkSidebar
        sections={sections}
        section={section}
        setSection={setSection}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Section header */}
        <div className="shrink-0 border-b border-sidebar-border px-6 py-4">
          <h3 className="text-[15px] font-semibold">{meta.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {meta.description}
          </p>
        </div>
        {/* Section body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {section === "details" && (
            <CreateLinkDetailsSection
              path={form.path}
              setPath={form.setPath}
              pathAvailable={form.pathAvailable}
              name={form.name}
              setName={form.setName}
              tags={form.tagList}
              setTagList={form.setTagList}
              domain={domain}
              linkType={form.linkType}
              setLinkType={form.setLinkType}
              disabledActions={disabledActions}
              showErrors={showErrors}
            />
          )}
          {section === "social_media_preview" && (
            <CreateLinkSocialMediaPreview
              title={form.socialMediaTitle}
              setTitle={form.setSocialMediaTitle}
              subtitle={form.socialMediaSubTitle}
              setSubtitle={form.setSocialMediaSubTitle}
              imageType={form.imageType}
              setImageType={form.setImageType}
              imageFile={form.imageFile}
              setImageFile={form.setImageFile}
              imageLink={form.imageLink}
              setImageLink={form.setImageLink}
              setImagePreview={form.setImagePreview}
              imagePreview={form.imagePreview}
              disabledActions={disabledActions}
            />
          )}
          {section === "data" && (
            <CreateLinkDataSection
              addKeyValuePair={form.addKeyValuePair}
              data={form.keyValuePair}
              columns={form.columns}
              disabledActions={disabledActions}
            />
          )}
          {section === "redirects" && (
            <CreateLinksRedirectsSection
              androidRedirectURL={form.androidRedirectURL}
              setAndroidRedirectURL={form.setAndroidRedirectURL}
              androidRedirectType={form.androidRedirectType}
              setAndroidRedirectType={form.setAndroidRedirectType}
              showPreviewAndroid={form.showPreviewAndroid}
              setShowPreviewAndroid={form.setShowPreviewAndroid}
              iosRedirectURL={form.iOSRedirectURL}
              setIosRedirectURL={form.setiOSRedirectURL}
              iosRedirectType={form.iOSRedirectType}
              setIosRedirectType={form.setiOSRedirectType}
              setShowPreviewIOS={form.setShowPreviewIOS}
              showPreviewIOS={form.showPreviewIOS}
              copyToClipboardAndroid={form.copyToClipboardAndroid}
              setCopyToClipboardAndroid={form.setCopyToClipboardAndroid}
              copyToClipboardIOS={form.copyToClipboardIOS}
              setCopyToClipboardIOS={form.setCopyToClipboardIOS}
              projectShowPreviewAndroid={
                !!projectRedirectsConfig?.show_preview_android
              }
              projectShowPreviewIOS={!!projectRedirectsConfig?.show_preview_ios}
              projectCopyToClipboardAndroid={
                !!projectRedirectsConfig?.copy_to_clipboard_android
              }
              projectCopyToClipboardIOS={
                !!projectRedirectsConfig?.copy_to_clipboard_ios
              }
              desktopRedirectURL={form.desktopRedirectURL}
              setDesktopRedirectURL={form.setDesktopRedirectURL}
              desktopRedirectType={form.desktopRedirectType}
              setDesktopRedirectType={form.setDesktopRedirectType}
              disabledActions={disabledActions}
              showErrors={showErrors}
            />
          )}
          {section === "tracking" && (
            <CreateLinkTrackingSection
              source={form.utmSource}
              setSource={form.setUtmSource}
              medium={form.utmMedium}
              setMedium={form.setUtmMedium}
              campaignName={form.utmCampaign}
              setCampaignName={form.setUtmCampaign}
              disabledActions={disabledActions}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkDialogContent;
