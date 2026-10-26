"use client";
import { useEffect, useRef, useState } from "react";
import { Choice } from "@/components/composer/fields";
import MessageSection from "@ee/components/in_app/composer/MessageSection";
import TriggerSection from "@ee/components/in_app/composer/TriggerSection";
import PreviewPanel from "@ee/components/in_app/composer/PreviewPanel";
import { useInAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import { FieldError } from "@/components/common/FieldError";
import { IMAGE_MAX_BYTES } from "@ee/components/in_app/composer/MessageSection";
import { MediaPanel } from "@ee/components/in_app/composer/html/MediaPanel";
import { mediaUsed } from "@ee/lib/inAppHtml";
import { inAppDraftOf, inAppFields, journeyErrorText } from "@ee/lib/journeys";
import { ORIENTATION_LABELS } from "@ee/lib/inApp";
import { IN_APP_ORIENTATIONS } from "@ee/types/inApp";
import type { InAppImageSlot, InAppMedia } from "@ee/types/inApp";
import type { InAppDraft } from "@ee/lib/inAppComposer";
import type { InAppJourneyStep } from "@ee/types/journey";
import type { UploadImage } from "../StepPanel";

const VALID = [1, 3, 7, 14, 30].map((days) => ({
  value: String(days),
  label: days === 1 ? "1 day" : `${days} days`,
}));

// Files the step's HTML already uses (Active Storage blob URLs), so they stay listed after a remount.
const usedFiles = (html: string): InAppMedia[] =>
  [
    ...new Set(
      html.match(/[^\s"'()<>]*\/rails\/active_storage\/blobs\/[^\s"'()<>]+/g)
    ),
  ].map((url) => ({ id: url, url, type: "", bytes: 0, used: true }));

// Its own in-app draft, remounted per step; the step keeps what the API takes.
export default function InAppPanel({
  projectId,
  step,
  locked,
  onChange,
  uploadImage,
}: {
  projectId: string;
  step: InAppJourneyStep;
  locked: boolean;
  onChange: (step: InAppJourneyStep) => void;
  uploadImage: UploadImage;
}) {
  const [draft, setDraft] = useState<InAppDraft>(() => inAppDraftOf(step));
  const suggestions = useInAppSuggestions(projectId);
  // Every change goes through set, so this is always the newest draft; uploads patch it late.
  const latest = useRef(draft);
  // An upload that finished after this panel was left and reopened arrives as the step's image.
  const [seen, setSeen] = useState(step.content.image);
  if (step.content.image !== seen) {
    setSeen(step.content.image);
    const portrait = step.content.image?.portrait ?? null;
    const landscape = step.content.image?.landscape ?? null;
    if (
      portrait !== draft.image.portrait ||
      landscape !== draft.image.landscape
    )
      setDraft({ ...draft, image: { portrait, landscape } });
  }
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  // A late upload builds on the newest step, not the one it started with.
  const latestStep = useRef(step);
  useEffect(() => {
    latestStep.current = step;
  }, [step]);
  const set = (patch: Partial<InAppDraft>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    onChange({ ...latestStep.current, ...inAppFields(next) });
  };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // A panel left before its upload ends drops it rather than overwrite the step with its old draft.
  const setHtml = (update: (html: string) => string) => {
    if (mounted.current) set({ html: update(latest.current.html) });
  };
  const [uploading, setUploading] = useState<InAppImageSlot | null>(null);
  const [files, setFiles] = useState<InAppMedia[]>(() => usedFiles(draft.html));
  const [designing, setDesigning] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // A file only needs a URL; the step itself does not change.
  const upload = (file: File) => uploadImage(step, file, (s) => s);
  const onImage = async (slot: InAppImageSlot, file: File | null) => {
    setUploadError(null);
    if (!file) return set({ image: { ...latest.current.image, [slot]: null } });
    if (!["image/png", "image/jpeg", "image/gif"].includes(file.type))
      return setUploadError("The image must be a PNG, JPEG or GIF.");
    if (file.size > IMAGE_MAX_BYTES)
      return setUploadError("The image must be under 1 MB.");
    setUploading(slot);
    try {
      // The panel may be gone by now: the editor sets only this image of the current step.
      const url = await uploadImage(step, file, (s, url) =>
        s.type === "in_app"
          ? {
              ...s,
              content: {
                ...s.content,
                image: {
                  portrait: s.content.image?.portrait ?? null,
                  landscape: s.content.image?.landscape ?? null,
                  [slot]: url,
                },
              },
            }
          : s
      );
      latest.current = {
        ...latest.current,
        image: { ...latest.current.image, [slot]: url },
      };
      setDraft(latest.current);
    } catch (e) {
      setUploadError(journeyErrorText(e, "Could not upload the image."));
    } finally {
      setUploading(null);
    }
  };
  return (
    <div className="space-y-6">
      <MessageSection
        draft={draft}
        images={draft.image}
        set={set}
        setHtml={setHtml}
        variant="a"
        variantBar={null}
        launched={locked}
        uploading={uploading}
        onImage={(slot, file) => void onImage(slot, file)}
        suggestions={suggestions}
        media={
          // A journey's uploads have no list of their own: this shows the ones made in the panel, which keeps them.
          <MediaPanel
            items={files.map((m) => ({
              ...m,
              used: mediaUsed([draft.html], m.url),
            }))}
            onUpload={async (file) => {
              const url = await upload(file);
              setFiles((old) => [
                ...old.filter((m) => m.url !== url),
                {
                  id: url,
                  url,
                  type: file.type,
                  bytes: file.size,
                  used: false,
                },
              ]);
            }}
          />
        }
        uploadMedia={upload}
        onDesignChange={setDesigning}
      />
      <FieldError message={uploadError ?? undefined} />
      <div className="space-y-2">
        <p className="text-[13px] font-medium">When to show it</p>
        <p className="text-xs text-muted-foreground">
          Once someone reaches this step, the message shows at the first of
          these moments.
        </p>
        <TriggerSection
          projectId={projectId}
          draft={draft}
          set={set}
          suggestions={suggestions}
          delay={false}
          compact
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sidebar-border p-3">
        <div>
          <p className="text-[13px] font-medium">Keep it for</p>
          <p className="text-xs text-muted-foreground">
            It moves on once shown, or when this runs out.
          </p>
        </div>
        <Choice
          label="Keep it for"
          className="w-32"
          value={String(step.valid_days)}
          options={
            VALID.some((v) => v.value === String(step.valid_days))
              ? VALID
              : [
                  ...VALID,
                  {
                    value: String(step.valid_days),
                    label: `${step.valid_days} days`,
                  },
                ]
          }
          onChange={(days) => onChange({ ...step, valid_days: Number(days) })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sidebar-border p-3">
        <div>
          <p className="text-[13px] font-medium">Orientation</p>
          <p className="text-xs text-muted-foreground">
            Shows only while the screen is held that way, and closes if it
            turns.
          </p>
        </div>
        <Choice
          label="Orientation"
          className="w-32"
          value={draft.orientation}
          options={IN_APP_ORIENTATIONS.map((value) => ({
            value,
            label: ORIENTATION_LABELS[value],
          }))}
          onChange={(orientation) => set({ orientation })}
        />
      </div>
      {!designing && (
        <div className="rounded-lg border border-sidebar-border bg-sidebar p-4">
          <PreviewPanel draft={draft} />
        </div>
      )}
    </div>
  );
}
