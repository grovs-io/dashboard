"use client";
import { FULL_CHECK } from "@/constants/OptionsConstants";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import React from "react";

const SECTION_DESCRIPTIONS: Record<string, string> = {
  details: "Core info for your link",
  social_media_preview: "How it looks when shared",
  data: "Custom key–value payload",
  redirects: "Per-platform destinations",
  tracking: "UTM campaign parameters",
};

const CreateLinkSidebar = React.memo(function CreateLinkSidebar({
  sections,
  section,
  setSection,
}: {
  sections: {
    text: string;
    value: string;
    checked: string;
  }[];
  section: string;
  setSection: (value: string) => void;
}) {
  return (
    <nav className="flex w-[260px] shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
      {sections.map((item, index) => {
        const isActive = section === item.value;
        const isDone = item.checked === FULL_CHECK;

        return (
          <button
            key={item.value}
            aria-current={isActive ? "step" : undefined}
            onClick={() => setSection(item.value)}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              isActive
                ? "bg-background dark:bg-muted shadow-sm ring-1 ring-sidebar-border"
                : "hover:bg-muted/60"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                isDone
                  ? "bg-valid-green-light text-valid-green"
                  : isActive
                    ? "bg-primary text-white dark:bg-primary/20 dark:text-primary"
                    : "border border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-[13px] font-medium",
                  isActive ? "text-foreground" : "text-sidebar-foreground"
                )}
              >
                {item.text}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {SECTION_DESCRIPTIONS[item.value] ?? ""}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
});

export default CreateLinkSidebar;
