"use client";

import type { AuditEvent } from "@/types";

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{value}</span>
    </>
  );
}

export default function AuditEventDetails({ event }: { event: AuditEvent }) {
  const { actor, target, changes } = event;
  const hasDiff = "before" in changes || "after" in changes;
  const targetLabel = [
    target.type
      ? `${String(target.type)}${target.id != null ? ` #${String(target.id)}` : ""}`
      : null,
    target.email ? String(target.email) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="bg-muted/40 px-5 py-4 flex flex-col gap-4">
      <div className="grid grid-cols-[120px_1fr] gap-y-1 text-xs">
        <Field
          label="Actor"
          value={[actor.email, actor.type, actor.via]
            .filter(Boolean)
            .join(" · ")}
        />
        <Field label="IP" value={event.ip ?? "—"} />
        <Field label="User agent" value={event.user_agent ?? "—"} />
        <Field label="Request ID" value={event.request_id ?? "—"} />
        <Field label="Target" value={targetLabel || "—"} />
        <Field label="Outcome" value={event.outcome} />
      </div>

      {hasDiff ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">Before</span>
            <pre className="text-[11px] font-mono bg-background rounded-md border border-sidebar-border p-2 overflow-x-auto">
              {pretty(changes.before ?? null)}
            </pre>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">After</span>
            <pre className="text-[11px] font-mono bg-background rounded-md border border-sidebar-border p-2 overflow-x-auto">
              {pretty(changes.after ?? null)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">Changes</span>
          {Object.keys(changes).length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <pre className="text-[11px] font-mono bg-background rounded-md border border-sidebar-border p-2 overflow-x-auto">
              {pretty(changes)}
            </pre>
          )}
        </div>
      )}

      <div
        className="font-mono text-[11px] text-muted-foreground"
        title={`hash ${event.hash}\nprev ${event.prev_hash ?? "genesis"}`}
      >
        #{event.sequence} · hash {event.hash.slice(0, 12)}… · prev{" "}
        {event.prev_hash ? `${event.prev_hash.slice(0, 12)}…` : "genesis"}
      </div>
    </div>
  );
}
