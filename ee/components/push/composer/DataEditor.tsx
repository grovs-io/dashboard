"use client";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/common/FieldError";
import { cn } from "@/lib/utils";
import {
  MAX_DATA_BYTES,
  RESERVED_KEY_MESSAGE,
  dataBytes,
  dataRowsToObject,
  reservedDataKey,
  type PushContentFormValues,
} from "@/schemas/push";

interface Props {
  form: UseFormReturn<PushContentFormValues>;
}

export default function DataEditor({ form }: Props) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "data",
  });
  const rows = useWatch({ control: form.control, name: "data" }) ?? [];
  const bytes = dataBytes(dataRowsToObject(rows));
  const rowErrors = form.formState.errors.data;
  const overCap = bytes > MAX_DATA_BYTES;

  return (
    <div className="space-y-2">
      {fields.map((field, index) => {
        const key = rows[index]?.key ?? "";
        const reserved = reservedDataKey(key.trim());
        const error = reserved
          ? RESERVED_KEY_MESSAGE
          : rowErrors?.[index]?.key?.message;
        return (
          <div key={field.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Data key ${index + 1}`}
                aria-invalid={!!error}
                placeholder="key"
                className="font-mono text-xs"
                {...form.register(`data.${index}.key`)}
              />
              <Input
                aria-label={`Data value ${index + 1}`}
                placeholder="value"
                className="font-mono text-xs"
                {...form.register(`data.${index}.value`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove data row ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <FieldError message={error} />
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ key: "", value: "" })}
        >
          <Plus className="size-3.5" /> Add field
        </Button>
        <span
          className={cn(
            "text-xs tabular-nums",
            overCap ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {bytes.toLocaleString()} / {MAX_DATA_BYTES.toLocaleString()} bytes
        </span>
      </div>
      <FieldError
        message={
          overCap
            ? "Custom data is too large: at most 2 KB in total. Remove some keys or shorten values."
            : (rowErrors?.root?.message ?? rowErrors?.message)
        }
      />
    </div>
  );
}
