"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
export { humanize } from "@ee/lib/segmentLabels";

export function Word({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </span>
  );
}

interface PickProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean; hint?: string }[];
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}

// A compact select rendered as one word of the condition sentence.
export function Pick<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  placeholder,
}: PickProps<T>) {
  const disabledHint = options.find((o) => o.disabled && o.hint)?.hint;
  const trigger = (
    <SelectTrigger
      size="sm"
      className={cn("h-8 bg-background", className)}
      aria-label={ariaLabel}
    >
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
  );
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      {disabledHint ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{disabledHint}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
