"use client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { catalogueEntry } from "@ee/lib/segments";
import type {
  SegmentCatalogue,
  SegmentConditionType,
} from "@ee/types/segments";
import { CONDITION_TYPES } from "./conditionTypes";

interface Props {
  catalogue: SegmentCatalogue;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: (type: SegmentConditionType) => void;
}

export default function AddConditionMenu({
  catalogue,
  disabled,
  disabledReason,
  onSelect,
}: Props) {
  const purchase = catalogueEntry(catalogue, "purchase");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-primary hover:text-primary"
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          <Plus className="size-4" /> Add condition
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {CONDITION_TYPES.map(({ type, label, description, icon: Icon }) => {
          const off = type === "purchase" && purchase?.enabled === false;
          return (
            <DropdownMenuItem
              key={type}
              disabled={off}
              onSelect={() => onSelect(type)}
              className="items-start gap-3 py-2"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {off ? "Needs revenue collection" : description}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
