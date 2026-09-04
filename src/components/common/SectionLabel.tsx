export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 shrink-0">
        {children}
      </h2>
      <div className="h-px flex-1 bg-sidebar-border" />
    </div>
  );
}
