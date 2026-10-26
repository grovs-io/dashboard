"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SegmentOperator } from "@ee/types/segments";

interface Props {
  value: SegmentOperator;
  onChange: (operator: SegmentOperator) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}

// The and/or word between two rows (or two groups), styled like every other word-select in a condition.
export default function Connector({
  value,
  onChange,
  ariaLabel,
  size = "sm",
}: Props) {
  const noun = size === "md" ? "group" : "condition";
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        size === "md" ? "py-1" : "py-2.5 pl-2"
      )}
    >
      {size === "md" && <span className="h-px flex-1 bg-sidebar-border" />}
      <Select
        value={value}
        onValueChange={(v) => onChange(v as SegmentOperator)}
      >
        <SelectTrigger
          size="sm"
          className="h-7 w-fit bg-background px-2 text-xs font-medium uppercase tracking-wide"
          aria-label={ariaLabel}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="and"
            title={`must match every ${noun}`}
            className="text-xs font-medium uppercase tracking-wide"
          >
            and
          </SelectItem>
          <SelectItem
            value="or"
            title={`must match at least one ${noun}`}
            className="text-xs font-medium uppercase tracking-wide"
          >
            or
          </SelectItem>
        </SelectContent>
      </Select>
      {size === "md" && <span className="h-px flex-1 bg-sidebar-border" />}
    </div>
  );
}
