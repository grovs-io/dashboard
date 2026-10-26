import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// The dashboard's panel card (Channels, Top links).
export default function ReportCard({
  title,
  aside,
  className,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col rounded-md border border-sidebar-border bg-muted/50 p-4 dark:bg-card",
        className
      )}
    >
      <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 id={headingId} className="text-sm font-medium">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
