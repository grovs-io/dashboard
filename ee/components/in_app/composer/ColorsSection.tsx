"use client";
import { useState } from "react";
import { ChevronDown, Palette } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { TEMPLATES } from "@ee/lib/inApp";
import {
  COLOR_THEMES,
  isDark,
  sameColors,
  type ColorTheme,
  type InAppDraft,
} from "@ee/lib/inAppComposer";
import ColorField from "@/components/composer/ColorField";

// A small message in the theme's colours, so a theme is chosen by how it looks.
function Sample({ theme }: { theme: ColorTheme }) {
  const background = theme.colors.background ?? "#FFFFFF";
  const dark = isDark(background);
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full flex-col justify-center gap-1 rounded-md border border-black/10 px-2.5"
      style={{ backgroundColor: background }}
    >
      <span
        className="h-1.5 w-3/5 rounded-full"
        style={{
          backgroundColor: theme.colors.title ?? (dark ? "#FFFFFF" : "#111111"),
        }}
      />
      <span
        className="h-1 w-4/5 rounded-full opacity-70"
        style={{
          backgroundColor:
            theme.colors.message ?? (dark ? "#FFFFFF" : "#333333"),
        }}
      />
      <span
        className="mt-0.5 h-2.5 w-2/5 rounded-[3px]"
        style={{ backgroundColor: theme.button(0).background ?? "#2A86FF" }}
      />
    </span>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="divide-y divide-sidebar-border overflow-hidden rounded-lg border border-sidebar-border">
        {children}
      </div>
    </div>
  );
}

export default function ColorsSection({
  draft,
  set,
}: {
  draft: InAppDraft;
  set: (patch: Partial<InAppDraft>) => void;
}) {
  const [open, setOpen] = useState(false);
  const kind = TEMPLATES[draft.template];
  const dark = !!draft.colors.background && isDark(draft.colors.background);
  const text = dark ? "#FFFFFF" : "#111111";
  const buttons = kind.imageOnly || draft.question ? [] : draft.buttons;
  const theme = COLOR_THEMES.find(
    (t) =>
      sameColors(t.colors, draft.colors) &&
      buttons.every((b, i) => sameColors(t.button(i), b.colors ?? {}))
  );
  const setColor = (key: keyof InAppDraft["colors"], value?: string) =>
    set({ colors: { ...draft.colors, [key]: value } });
  const setButton = (
    index: number,
    key: "background" | "text",
    value?: string
  ) =>
    set({
      buttons: draft.buttons.map((b, i) =>
        i === index ? { ...b, colors: { ...b.colors, [key]: value } } : b
      ),
    });

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-sidebar-border"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 p-3 text-left">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <Palette className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Colours</span>
          <span className="block text-xs text-muted-foreground">
            {theme ? `${theme.name} theme` : "Your own colours"}
          </span>
        </span>
        <span className="flex -space-x-1" aria-hidden="true">
          {[
            draft.colors.background ?? "#FFFFFF",
            draft.colors.title ?? text,
            buttons[0]?.colors?.background ?? "#2A86FF",
          ].map((color, i) => (
            <span
              key={i}
              className="size-4 rounded-full border border-background ring-1 ring-black/10"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t border-sidebar-border p-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Theme</p>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid grid-cols-3 gap-2"
          >
            {COLOR_THEMES.map((item) => {
              const on = theme?.name === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={item.name}
                  onClick={() =>
                    set({
                      colors: { ...item.colors },
                      buttons: draft.buttons.map((b, i) => ({
                        ...b,
                        colors: { ...item.button(i) },
                      })),
                    })
                  }
                  className={cn(
                    "space-y-1.5 rounded-lg border p-1.5 text-left transition-colors",
                    on
                      ? "border-primary bg-accent ring-1 ring-primary"
                      : "border-sidebar-border hover:bg-muted/60"
                  )}
                >
                  <Sample theme={item} />
                  <span className="block px-1 text-xs font-medium">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Group title="Message">
          <ColorField
            label="Background"
            fallback="#FFFFFF"
            value={draft.colors.background}
            onChange={(value) => setColor("background", value)}
          />
          {!kind.imageOnly && (
            <>
              <ColorField
                label="Title"
                fallback={text}
                value={draft.colors.title}
                onChange={(value) => setColor("title", value)}
              />
              <ColorField
                label="Text"
                fallback={text}
                value={draft.colors.message}
                onChange={(value) => setColor("message", value)}
              />
            </>
          )}
        </Group>

        {buttons.map((button, index) => (
          <Group
            key={button.id}
            title={`Button ${index + 1}${button.text ? `, ${button.text}` : ""}`}
          >
            <ColorField
              label="Fill"
              fallback={index === 0 ? "#2A86FF" : "#E9EEF5"}
              value={button.colors?.background}
              onChange={(value) => setButton(index, "background", value)}
            />
            <ColorField
              label="Label"
              fallback={index === 0 ? "#FFFFFF" : "#111111"}
              value={button.colors?.text}
              onChange={(value) => setButton(index, "text", value)}
            />
          </Group>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
