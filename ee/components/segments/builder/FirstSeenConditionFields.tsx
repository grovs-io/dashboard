"use client";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FirstSeenCondition } from "@ee/types/segments";
import { Pick } from "./InlineControls";

interface Props {
  condition: FirstSeenCondition;
  onChange: (condition: FirstSeenCondition) => void;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function FirstSeenConditionFields({
  condition,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const date = ISO.test(condition.value)
    ? parseISO(condition.value)
    : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pick
        ariaLabel="First seen operator"
        value={condition.op}
        onChange={(op) => onChange({ ...condition, op })}
        options={[
          { value: "gte", label: "on or after" },
          { value: "lte", label: "on or before" },
        ]}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 font-normal"
            aria-label="First seen date"
            aria-expanded={open}
          >
            <CalendarDays className="size-3.5 text-muted-foreground" />
            {date ? format(date, "MMM d, yyyy") : "pick a date"}
            <ChevronDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            disabled={{ after: new Date() }}
            onSelect={(d) => {
              if (!d) return;
              onChange({ ...condition, value: format(d, "yyyy-MM-dd") });
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
