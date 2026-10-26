"use client";
import { Input } from "@/components/ui/input";
import { ACTION_LABELS, APP_ONLY_ACTIONS } from "@ee/lib/inApp";
import { IN_APP_ACTIONS, type InAppAction } from "@ee/types/inApp";
import { Choice } from "@/components/composer/fields";

const OPTIONS = IN_APP_ACTIONS.map((value) => ({
  value,
  label: ACTION_LABELS[value],
}));

const toText = (payload: Record<string, string> | undefined) =>
  Object.entries(payload ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

// One pair per line, key=value; a line without "=" is dropped.
export function toPayload(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const at = line.indexOf("=");
    const key = at > 0 ? line.slice(0, at).trim() : "";
    if (key) out[key] = line.slice(at + 1).trim();
  }
  return out;
}

export default function ActionEditor({
  label,
  action,
  onChange,
  typeless = false,
}: {
  label: string;
  action: InAppAction;
  onChange: (action: InAppAction) => void;
  // The kind of action is chosen elsewhere; only its details are asked here.
  typeless?: boolean;
}) {
  return (
    <div className="space-y-2">
      {!typeless && (
        <Choice
          label={`${label} action`}
          value={action.type}
          options={OPTIONS}
          onChange={(type) => onChange({ ...action, type })}
        />
      )}
      {APP_ONLY_ACTIONS.includes(action.type) && (
        <p className="text-xs text-muted-foreground">
          Apps only. Web visitors are not shown a message that does this.
        </p>
      )}
      {action.type === "open_url" && (
        <Input
          aria-label={`${label} link`}
          placeholder="https://example.com/offer or myapp://offer"
          value={action.url ?? ""}
          onChange={(e) => onChange({ ...action, url: e.target.value })}
        />
      )}
      {action.type === "key_value" && (
        <textarea
          aria-label={`${label} data`}
          placeholder={"screen=offers\ncode=AUTUMN"}
          className="min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
          defaultValue={toText(action.payload)}
          onChange={(e) =>
            onChange({ ...action, payload: toPayload(e.target.value) })
          }
        />
      )}
    </div>
  );
}
