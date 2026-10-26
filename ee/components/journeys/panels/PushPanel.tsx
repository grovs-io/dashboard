"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { FieldError } from "@/components/common/FieldError";
import { useGlobalLinkDialog } from "@/context/useLinkDialogContext";
import { useWatch } from "react-hook-form";
import { useProjectSelection } from "@/context/useProjectSelection";
import NotificationPreview from "@ee/components/push/composer/NotificationPreview";
import { Switch } from "@/components/ui/switch";
import MessageSection, {
  usePushContentForm,
} from "@ee/components/push/composer/MessageSection";
import { journeyErrorText, pushFields, pushFormValues } from "@ee/lib/journeys";
import type { PushContentFormValues } from "@/schemas/push";
import type { PushStep } from "@ee/types/journey";
import type { UploadImage } from "../StepPanel";

const fieldsOf = (values: PushContentFormValues, uploaded: string | null) => {
  const fields = pushFields(values);
  return { ...fields, image_url: fields.image_url ?? uploaded };
};

// Its own form, remounted per step; what it holds goes up as the step's fields.
export default function PushPanel({
  projectId,
  step,
  onChange,
  uploadImage,
}: {
  projectId: string;
  step: PushStep;
  onChange: (step: PushStep) => void;
  uploadImage: UploadImage;
}) {
  const form = usePushContentForm(pushFormValues(step));
  const latest = useRef<{
    step: PushStep;
    onChange: (step: PushStep) => void;
    uploaded: string | null;
  }>({ step, onChange, uploaded: null });
  const values = useWatch({ control: form.control }) as PushContentFormValues;
  const { selectedProject } = useProjectSelection();
  const { openLinkDialog } = useGlobalLinkDialog();
  // The picked file shows while it uploads; an uploaded image stands beside a typed URL, which wins.
  const [picked, setPicked] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // An upload that finished after this panel was left and reopened arrives as the step's image.
  const [seen, setSeen] = useState(step.image_url);
  if (step.image_url !== seen) {
    setSeen(step.image_url);
    const typed = form.getValues().imageUrl.trim();
    if (
      step.image_url &&
      step.image_url !== typed &&
      step.image_url !== uploaded
    )
      setUploaded(step.image_url);
  }
  const send = (next: string | null) => {
    latest.current.uploaded = next;
    latest.current.onChange({
      ...latest.current.step,
      ...fieldsOf(form.getValues(), next),
    });
  };
  const upload = async (file: File | null) => {
    setUploadError(null);
    setPicked(file);
    if (!file) return;
    try {
      // The panel may be gone by now: the editor sets only the image field of the current step.
      const url = await uploadImage(step, file, (s, url) =>
        s.type === "push"
          ? { ...s, image_url: form.getValues().imageUrl.trim() || url }
          : s
      );
      latest.current.uploaded = url;
      setUploaded(url);
    } catch (e) {
      setUploadError(journeyErrorText(e, "Could not upload the image."));
    } finally {
      setPicked(null);
    }
  };
  const createLink = () =>
    openLinkDialog({
      onSuccess: (link) => {
        if (link)
          form.setValue("linkId", Number(link.id), {
            shouldDirty: true,
            shouldValidate: true,
          });
      },
    });
  useEffect(() => {
    latest.current.step = step;
    latest.current.onChange = onChange;
    latest.current.uploaded = uploaded;
  });
  useEffect(() => {
    const sub = form.watch((values) =>
      latest.current.onChange({
        ...latest.current.step,
        ...fieldsOf(values as PushContentFormValues, latest.current.uploaded),
      })
    );
    return () => sub.unsubscribe();
  }, [form]);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <MessageSection
          projectId={projectId}
          form={form}
          imageFile={picked}
          onImageFileChange={(file) => void upload(file)}
          uploadedImage={uploaded}
          onRemoveUploadedImage={() => {
            setUploaded(null);
            send(null);
          }}
          removingImage={picked !== null}
          onCreateLink={createLink}
          placeholders={{ title: "Write a title", body: "Write a body" }}
        />
        {picked !== null && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Uploading the image…
          </p>
        )}
        <FieldError message={uploadError ?? undefined} />
      </div>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-sidebar-border p-3 text-[13px]">
        <span>
          Only between 09:00 and 21:00 their time
          <span className="block text-xs text-muted-foreground">
            Outside those hours it waits for the next 09:00.
          </span>
        </span>
        <Switch
          aria-label="Quiet hours"
          checked={step.quiet_hours}
          onCheckedChange={(quiet_hours) => onChange({ ...step, quiet_hours })}
        />
      </label>
      <div>
        <NotificationPreview
          appName={selectedProject?.name ?? "Your app"}
          title={values.title ?? ""}
          body={values.body ?? ""}
          image={values.imageUrl?.trim() || uploaded}
        />
      </div>
    </div>
  );
}
