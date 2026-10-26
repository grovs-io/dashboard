"use client";
import { useId, useState } from "react";
import { useTheme } from "next-themes";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAYOUT_LABELS } from "@ee/lib/inApp";
import { HTML_FIELD } from "@ee/lib/inAppHtml";
import { GALLERY, type GalleryExample } from "@ee/lib/inAppHtmlGallery";
import type { InAppLayout } from "@ee/types/inApp";
import { SAMPLE_USER, SCREENS, messageBox } from "./HtmlPreview";

// No scripts run here and a frame's color-scheme doesn't always reach the page: fill and theme it here.
export const thumbnailHtml = (html: string, dark = false) =>
  html
    .replace(
      HTML_FIELD,
      (_, source: string, key: string, fallback?: string) => {
        const known =
          source === "user"
            ? (SAMPLE_USER as Record<string, string>)[key]
            : undefined;
        return known ?? fallback ?? "";
      }
    )
    .replaceAll("(prefers-color-scheme: dark)", dark ? "all" : "not all");

const SCREEN = SCREENS.phone;

// A still picture of the message on a phone: no scripts run, so script-drawn parts are missing.
export function Thumb({
  html,
  layout,
  title,
  dark,
  scale = 0.3,
}: {
  html: string;
  layout: InAppLayout;
  title: string;
  dark: boolean;
  scale?: number;
}) {
  const [height, setHeight] = useState(0);
  const full = layout === "full";
  const place = messageBox(layout, height, "phone");
  return (
    <div
      aria-hidden="true"
      style={{ width: SCREEN.width * scale, height: SCREEN.height * scale }}
      className="relative box-content shrink-0 overflow-hidden rounded-[14px] border-[3px] border-[#1B1F27] shadow-lg"
    >
      <div
        style={{
          width: SCREEN.width,
          height: SCREEN.height,
          transform: `scale(${scale})`,
        }}
        className={cn(
          "pointer-events-none absolute left-0 top-0 origin-top-left",
          dark ? "bg-[#111827]" : "bg-[#F3F5F8]"
        )}
      >
        <div className="space-y-4 p-6 pt-16">
          <div
            className={cn(
              "h-7 w-40 rounded-full",
              dark ? "bg-[#1F2937]" : "bg-[#E2E7EE]"
            )}
          />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-36 rounded-3xl",
                dark ? "bg-[#1F2937]" : "bg-white"
              )}
            />
          ))}
        </div>
        {layout === "modal" && <div className="absolute inset-0 bg-black/40" />}
        <iframe
          title={title}
          srcDoc={thumbnailHtml(html, dark)}
          // Same origin only to measure the page; without allow-scripts nothing in it runs.
          sandbox="allow-same-origin"
          tabIndex={-1}
          onLoad={(e) => {
            const root = e.currentTarget.contentDocument?.documentElement;
            if (root) setHeight(Math.ceil(root.getBoundingClientRect().height));
          }}
          style={{ ...place, colorScheme: dark ? "dark" : "light" }}
          className={cn(
            "absolute border-0 bg-transparent transition-opacity",
            layout === "modal" && "rounded-[22px]",
            !full && height === 0 && "opacity-0"
          )}
        />
        {(full || height > 0) && (
          <span
            style={{ left: place.left + place.width - 40, top: place.top + 8 }}
            className="absolute flex size-7 items-center justify-center rounded-full bg-black/45 text-white"
          >
            <X className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}

function Card({
  example,
  dark,
  onPick,
}: {
  example: GalleryExample;
  dark: boolean;
  onPick: (example: GalleryExample) => void;
}) {
  const id = useId();
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-sidebar-border bg-background transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring/50">
      <div className="flex h-[272px] items-center justify-center bg-gradient-to-b from-muted/30 to-muted/80">
        <Thumb
          html={example.html}
          layout={example.layout}
          title={example.title}
          dark={dark}
        />
      </div>
      <div className="space-y-1 border-t border-sidebar-border p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            aria-describedby={id}
            onClick={() => onPick(example)}
            className="text-left text-[13px] font-medium outline-none after:absolute after:inset-0"
          >
            {example.title}
          </button>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {LAYOUT_LABELS[example.layout]}
          </span>
        </div>
        <p id={id} className="text-xs text-muted-foreground">
          {example.description}
        </p>
      </div>
    </div>
  );
}

export default function Gallery({
  onPick,
}: {
  onPick: (example: GalleryExample) => void;
}) {
  const dark = useTheme().resolvedTheme === "dark";
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
      {GALLERY.map((example) => (
        <Card key={example.id} example={example} dark={dark} onPick={onPick} />
      ))}
    </div>
  );
}
