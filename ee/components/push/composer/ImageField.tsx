"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/common/FieldError";
import { FileUpload } from "@/components/common/file-upload";
import type { PushContentFormValues } from "@/schemas/push";

// Mirrors PushCampaign::IMAGE_MAX_BYTES: Firebase loads at most 1 MB.
export const IMAGE_MAX_BYTES = 1024 * 1024;
const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.gif";

interface Props {
  form: UseFormReturn<PushContentFormValues>;
  file: File | null;
  onFileChange: (file: File | null) => void;
  uploadedImage: string | null;
  onRemoveUploaded: () => void;
  removing?: boolean;
}

export default function ImageField({
  form,
  file,
  onFileChange,
  uploadedImage,
  onRemoveUploaded,
  removing,
}: Props) {
  const [fileError, setFileError] = useState<string | null>(null);
  const imageUrl = form.watch("imageUrl");
  const urlError = form.formState.errors.imageUrl?.message;
  const hasFile = !!file || !!uploadedImage;

  return (
    <div className="space-y-3">
      <FileUpload
        selectedFile={file}
        uploadedFilename={uploadedImage ? "Uploaded image" : null}
        accept={IMAGE_ACCEPT}
        serverError={fileError}
        onChange={(e) => {
          const picked = e.currentTarget.files?.[0] ?? null;
          e.currentTarget.value = "";
          if (!picked) return;
          if (picked.size > IMAGE_MAX_BYTES) {
            setFileError("This image is too big: it can be at most 1 MB.");
            onFileChange(null);
            return;
          }
          setFileError(null);
          onFileChange(picked);
        }}
      />
      {hasFile && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={removing}
          onClick={() => (file ? onFileChange(null) : onRemoveUploaded())}
        >
          {removing && <Loader2 className="size-3.5 animate-spin" />}
          Remove image
        </Button>
      )}
      <div className="space-y-1.5">
        <label
          htmlFor="push-image-url"
          className="text-xs text-muted-foreground"
        >
          Or an image URL
        </label>
        <Input
          id="push-image-url"
          placeholder="https://cdn.example.com/image.png"
          aria-invalid={!!urlError}
          {...form.register("imageUrl")}
        />
        <FieldError message={urlError} />
        {hasFile && imageUrl.trim() && (
          <p className="text-xs text-muted-foreground">
            The URL is used when both are set.
          </p>
        )}
      </div>
    </div>
  );
}
