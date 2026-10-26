"use client";
import { useState, type ReactNode } from "react";
import { FieldError } from "@/components/common/FieldError";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESETS = [0, 1, 3, 7, 14, 30, 90] as const;
const CUSTOM = "custom";

export const hidePeriodLabel = (days: number) =>
  days === 0 ? "Until the next page" : days === 1 ? "1 day" : `${days} days`;

export default function HidePeriodField({
  id,
  icon,
  title,
  description,
  value,
  error,
  onChange,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  value: number;
  error?: string;
  onChange: (days: number) => void;
}) {
  const preset = (PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!preset);
  const selected = custom ? CUSTOM : String(value);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-sidebar-border p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 space-y-0.5">
          <p id={`${id}-label`} className="text-[13px] font-medium">
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
          <FieldError message={error} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={selected}
          onValueChange={(next) => {
            if (next === CUSTOM) return setCustom(true);
            setCustom(false);
            onChange(Number(next));
          }}
        >
          <SelectTrigger
            className="h-8 w-[170px]"
            aria-labelledby={`${id}-label`}
            aria-invalid={!!error}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((days) => (
              <SelectItem key={days} value={String(days)}>
                {hidePeriodLabel(days)}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom…</SelectItem>
          </SelectContent>
        </Select>
        {custom && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Input
              type="number"
              min={0}
              max={365}
              className="h-8 w-20"
              aria-label={`${title}, days`}
              value={Number.isFinite(value) ? value : ""}
              onChange={(e) => onChange(e.target.valueAsNumber)}
            />
            days
          </div>
        )}
      </div>
    </div>
  );
}
