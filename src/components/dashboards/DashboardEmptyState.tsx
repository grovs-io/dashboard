"use client";

import { LayoutDashboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WidgetPayload } from "@/types/dashboards";
import { WIDGET_TEMPLATES } from "./widgetTemplates";

export function DashboardEmptyState({
  onAddWidget,
  onUseTemplate,
  pending,
}: {
  onAddWidget: () => void;
  onUseTemplate: (payload: WidgetPayload) => void | Promise<void>;
  pending: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-sidebar-border bg-sidebar px-6 py-12 flex flex-col items-center text-center"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted mb-4">
        <LayoutDashboard className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">Your dashboard is empty</h3>
      <p className="text-xs text-muted-foreground max-w-md leading-relaxed mb-6">
        Add widgets to chart any metric by any dimension. They follow the date
        range and filters above, and you can rearrange them by dragging.
      </p>
      <Button type="button" onClick={onAddWidget}>
        <Plus className="size-4" />
        Add widget
      </Button>

      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mt-10 mb-3">
        Or start with a template
      </p>
      <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WIDGET_TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              disabled={pending}
              aria-label={`Add ${t.title}`}
              onClick={() => onUseTemplate(t.payload)}
              className="flex items-start gap-3 rounded-lg border border-sidebar-border bg-background p-3 text-left hover:border-[var(--chart-users)]/60 hover:bg-muted/40 transition-colors disabled:opacity-60"
            >
              <div className="flex size-8 items-center justify-center rounded-md bg-muted shrink-0">
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[13px] font-medium">{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
