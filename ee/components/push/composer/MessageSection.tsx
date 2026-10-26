"use client";
import {
  useForm,
  useWatch,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/common/FieldError";
import {
  dataRowsToObject,
  pushContentSchema,
  type PushContentFormValues,
} from "@/schemas/push";
import {
  APNS_PAYLOAD_LIMIT_BYTES,
  apnsPayloadBytes,
  soundValue,
} from "@ee/lib/push";
import type { ReactNode } from "react";
import DataEditor from "./DataEditor";
import DeepLinkSelect, { useSelectedLink } from "./DeepLinkSelect";
import ImageField from "./ImageField";

// A staged upload has no URL yet; the backend's permanent asset URL runs about this long.
const PENDING_UPLOAD_URL = `https://${"x".repeat(112)}`;

export function usePushContentForm(defaults: PushContentFormValues) {
  return useForm<PushContentFormValues>({
    resolver: zodResolver(pushContentSchema) as Resolver<PushContentFormValues>,
    defaultValues: defaults,
    mode: "onChange",
  });
}

interface Props {
  projectId: string;
  form: UseFormReturn<PushContentFormValues>;
  imageFile: File | null;
  onImageFileChange: (file: File | null) => void;
  uploadedImage: string | null;
  onRemoveUploadedImage: () => void;
  removingImage?: boolean;
  onCreateLink?: () => void;
  // The variant bar, drawn above the fields.
  variantBar?: ReactNode;
  // Set while B or C is edited: Title and Body then read and write the variant, the rest stays A's.
  variant?: {
    title: string;
    body: string;
    onChange: (patch: { title?: string; body?: string }) => void;
    showErrors: boolean;
  };
  // Journeys prompt for the copy; campaigns show an example.
  placeholders?: { title: string; body: string };
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  description,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </label>
          {required && (
            <Badge
              variant="outline"
              className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
            >
              Required
            </Badge>
          )}
        </div>
        {hint}
      </div>
      {children}
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </div>
  );
}

const SOUND_OPTIONS = [
  { value: "default", label: "Default sound" },
  { value: "silent", label: "Silent" },
  { value: "custom", label: "Custom…" },
] as const;

const counter = (n: number, max: number) => (
  <span className="text-xs tabular-nums text-muted-foreground">
    {n} / {max}
  </span>
);

export default function MessageSection({
  projectId,
  form,
  imageFile,
  onImageFileChange,
  uploadedImage,
  onRemoveUploadedImage,
  removingImage,
  onCreateLink,
  variantBar,
  variant,
  placeholders,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const values = useWatch({ control: form.control }) as PushContentFormValues;
  const { errors } = form.formState;
  const { link } = useSelectedLink(projectId, values.linkId ?? null);
  const image =
    values.imageUrl?.trim() || (imageFile ? PENDING_UPLOAD_URL : uploadedImage);
  const payloadBytes = apnsPayloadBytes({
    title: values.title ?? "",
    body: values.body ?? "",
    data: dataRowsToObject(values.data ?? []),
    link: link?.access_path ?? null,
    image,
    sound: soundValue(values.soundMode ?? "default", values.sound ?? ""),
  });

  const dataCount = (values.data ?? []).filter((r) => r.key.trim()).length;
  const advancedErrors = !!errors.sound || !!errors.data;
  const titleError = variant
    ? variant.showErrors && !variant.title.trim()
      ? "Add a title: the bold first line people see."
      : undefined
    : errors.title?.message;
  const bodyError = variant
    ? variant.showErrors && !variant.body.trim()
      ? "Add the message: the text people see under the title."
      : undefined
    : errors.body?.message;

  return (
    <div className="flex flex-col gap-6">
      {variantBar}
      <Field
        label="Title"
        htmlFor="push-title"
        required
        hint={counter((variant?.title ?? values.title ?? "").length, 255)}
      >
        <Input
          // Remounted between A (the form's own field) and a variant (controlled).
          key={variant ? "variant" : "a"}
          id="push-title"
          placeholder={placeholders?.title ?? "e.g. Spring sale starts today"}
          aria-invalid={!!titleError}
          maxLength={variant ? 255 : undefined}
          {...(variant
            ? {
                value: variant.title,
                onChange: (e) => variant.onChange({ title: e.target.value }),
              }
            : form.register("title"))}
        />
        <FieldError message={titleError} />
      </Field>

      <Field
        label="Body"
        htmlFor="push-body"
        required
        hint={counter((variant?.body ?? values.body ?? "").length, 1000)}
      >
        <Textarea
          key={variant ? "variant" : "a"}
          id="push-body"
          rows={4}
          placeholder={
            placeholders?.body ??
            "What should people read on their lock screen?"
          }
          aria-invalid={!!bodyError}
          maxLength={variant ? 1000 : undefined}
          {...(variant
            ? {
                value: variant.body,
                onChange: (e) => variant.onChange({ body: e.target.value }),
              }
            : form.register("body"))}
        />
        <FieldError message={bodyError} />
      </Field>

      <Field
        label="Deep link"
        description="Opens this link in your app when the push is tapped."
      >
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <DeepLinkSelect
              projectId={projectId}
              value={values.linkId ?? null}
              onChange={(id) =>
                form.setValue("linkId", id, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </div>
          {onCreateLink && (
            <Button type="button" variant="outline" onClick={onCreateLink}>
              <Plus className="size-3.5" />
              New link
            </Button>
          )}
        </div>
      </Field>

      <Field label="Image">
        <ImageField
          form={form}
          file={imageFile}
          onFileChange={onImageFileChange}
          uploadedImage={uploadedImage}
          onRemoveUploaded={onRemoveUploadedImage}
          removing={removingImage}
        />
      </Field>

      <Collapsible
        open={advancedOpen || advancedErrors}
        onOpenChange={setAdvancedOpen}
        className="rounded-lg border border-sidebar-border"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
          >
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            Advanced
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {[
                dataCount
                  ? `${dataCount} data field${dataCount === 1 ? "" : "s"}`
                  : null,
                values.soundMode === "silent"
                  ? "silent"
                  : values.soundMode === "custom" && values.sound?.trim()
                    ? `sound: ${values.sound.trim()}`
                    : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Custom data, sound"}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-5 border-t border-sidebar-border px-4 py-4">
          <Field
            label="Custom data"
            description="Key–value pairs delivered to your app with the push."
          >
            <DataEditor form={form} />
          </Field>
          <Field label="Sound" htmlFor="push-sound-mode">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={values.soundMode ?? "default"}
                onValueChange={(mode) => {
                  form.setValue(
                    "soundMode",
                    mode as PushContentFormValues["soundMode"],
                    { shouldDirty: true, shouldValidate: true }
                  );
                  // The name error only belongs to Custom; re-check it for the new mode.
                  if (form.formState.errors.sound) void form.trigger("sound");
                }}
              >
                <SelectTrigger
                  id="push-sound-mode"
                  aria-label="Sound"
                  className="w-full sm:w-[200px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {values.soundMode === "custom" && (
                <Input
                  id="push-sound"
                  aria-label="Sound file"
                  placeholder="chime.caf"
                  maxLength={64}
                  aria-invalid={!!errors.sound}
                  className="w-full font-mono text-xs sm:w-auto sm:min-w-[160px] sm:flex-1"
                  {...form.register("sound")}
                />
              )}
            </div>
            {values.soundMode === "custom" && (
              <span className="text-xs text-muted-foreground">
                A sound file bundled in your app. Android also needs a
                notification channel with that sound.
              </span>
            )}
            <FieldError message={errors.sound?.message} />
          </Field>
        </CollapsibleContent>
      </Collapsible>

      {payloadBytes > APNS_PAYLOAD_LIMIT_BYTES && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            This push is about {payloadBytes.toLocaleString()} bytes; Apple
            allows {APNS_PAYLOAD_LIMIT_BYTES.toLocaleString()}. Shorten the body
            or the custom data.
          </span>
        </div>
      )}
    </div>
  );
}
