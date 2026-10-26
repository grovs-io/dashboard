"use client";
import ImageTile from "@/components/composer/ImageTile";
import type { InAppImageSlot } from "@ee/types/inApp";

const COPY: Record<InAppImageSlot, { title: string; hint: string }> = {
  portrait: { title: "Portrait", hint: "Phone held upright" },
  landscape: {
    title: "Landscape",
    hint: "Optional. Portrait is used when it is missing",
  },
};

export default function InAppImageTile({
  slot,
  url,
  busy,
  onImage,
}: {
  slot: InAppImageSlot;
  url: string | null;
  busy: boolean;
  onImage: (slot: InAppImageSlot, file: File | null) => void;
}) {
  return (
    <ImageTile
      name={`${slot} image`}
      title={COPY[slot].title}
      hint={COPY[slot].hint}
      url={url}
      busy={busy}
      accept="image/png,image/jpeg,image/gif"
      formats="PNG, JPEG or GIF, up to 1 MB"
      onFile={(file) => onImage(slot, file)}
    />
  );
}
