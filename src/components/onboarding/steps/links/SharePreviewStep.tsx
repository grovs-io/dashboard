"use client";

import { useEffect, useRef, useState } from "react";
import { showGenericError } from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import {
  useDomainConfigQuery,
  useDomainDefaultsQuery,
} from "@/hooks/queries/useConfigurationQueries";
import { useSetSubdomainMutation } from "@/hooks/mutations/useConfigurationMutations";
import type { Instance } from "@/types";
import {
  FieldLabel,
  FooterSpacer,
  Hint,
  Lead,
  OutlineButton,
  PrimaryButton,
  QuietButton,
  SetupInput,
  StepPage,
  StepTitle,
  TextLink,
} from "../../primitives";
import { SharePreviewPhone } from "../domain/DomainStep";

/** Sub-screen of Links: the project-wide social preview, saved to the existing domain settings. */
export const SharePreviewStep = ({
  instance,
  onBack,
  onNext,
}: {
  instance: Instance;
  onBack: () => void;
  onNext: () => void;
}) => {
  const prodId = instance.production?.id;
  const { data: domain } = useDomainConfigQuery(prodId);
  const { data: defaults } = useDomainDefaultsQuery(prodId);
  const save = useSetSubdomainMutation(prodId);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Seed once from the server; later edits are the user's.
  const [seeded, setSeeded] = useState(false);
  if (domain && !seeded) {
    setSeeded(true);
    setTitle(domain.generic_title ?? "");
    setSubtitle(domain.generic_subtitle ?? "");
  }

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const pick = (chosen: File | undefined) => {
    if (!chosen || !chosen.type.startsWith("image/")) return;
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };

  const changed =
    !!domain &&
    (title !== (domain.generic_title ?? "") ||
      subtitle !== (domain.generic_subtitle ?? "") ||
      !!file);

  const done = async () => {
    if (!domain || !changed) {
      onNext();
      return;
    }
    const form = new FormData();
    form.append("subdomain", domain.subdomain);
    form.append("generic_title", title.trim());
    form.append("generic_subtitle", subtitle.trim());
    if (domain.google_tracking_id)
      form.append("google_tracking_id", domain.google_tracking_id);
    // Re-sending generic_image_url makes the backend purge an uploaded image.
    if (file) form.append("generic_image", file);
    try {
      await save.mutateAsync(form);
      onNext();
    } catch {
      showGenericError();
    }
  };

  const currentImage =
    preview ?? domain?.generic_image_url ?? defaults?.generic_image_url ?? null;
  const usingDefaultImage = !preview && !domain?.generic_image_url;

  const left = (
    <>
      <StepTitle>How links look when shared</StepTitle>
      <Lead>
        The preview people see in iMessage, WhatsApp, Slack or X. Used for every
        link unless a link sets its own.
      </Lead>
      <div className="max-w-[560px]">
        <FieldLabel htmlFor="onb-share-title">Title</FieldLabel>
        <SetupInput
          id="onb-share-title"
          tone="plain"
          mono={false}
          value={title}
          onChange={setTitle}
          placeholder={defaults?.generic_title ?? "grovs"}
          className="text-sm"
        />
        <FieldLabel htmlFor="onb-share-desc" className="mt-4">
          Description
        </FieldLabel>
        <SetupInput
          id="onb-share-desc"
          tone="plain"
          mono={false}
          value={subtitle}
          onChange={setSubtitle}
          placeholder={defaults?.generic_subtitle ?? ""}
          className="text-sm"
        />
        <FieldLabel className="mt-4">Image</FieldLabel>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex items-center gap-3 rounded-[10px] border-[1.5px] border-dashed border-foreground/15 bg-muted p-3 dark:bg-white/[0.03]",
            over && "border-chart-users bg-chart-users/[0.05]"
          )}
        >
          <span className="h-11 w-[84px] shrink-0 overflow-hidden rounded-[7px] border border-border bg-background">
            {currentImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage}
                alt=""
                className="size-full object-cover"
              />
            )}
          </span>
          <span className="min-w-0 flex-1 text-[13px] text-foreground/75">
            {file
              ? file.name
              : usingDefaultImage
                ? "Default Grovs image"
                : "Your image"}
            <span className="block text-xs text-muted-foreground">
              {usingDefaultImage
                ? "Shown until you upload your own"
                : "Used for every link"}
            </span>
          </span>
          <OutlineButton onClick={() => input.current?.click()}>
            Upload image
          </OutlineButton>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            data-testid="share-image-input"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
        <Hint>PNG or JPG, 1200 × 630 works best. Or drop a file here.</Hint>
      </div>
    </>
  );

  return (
    <StepPage
      left={left}
      right={
        <SharePreviewPhone
          instance={instance}
          host={domain ? `${domain.subdomain}.${domain.domain}` : ""}
          title={title.trim() || defaults?.generic_title}
          imageUrl={currentImage}
        />
      }
      footer={
        <>
          <TextLink className="text-[13.5px]" onClick={onNext}>
            Skip, use defaults
          </TextLink>
          <FooterSpacer />
          <QuietButton onClick={onBack} className="hidden sm:inline-flex">
            Back
          </QuietButton>
          <PrimaryButton disabled={save.isPending} onClick={done}>
            Done
          </PrimaryButton>
        </>
      }
    />
  );
};
