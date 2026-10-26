"use client";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

const NOT_DIGITS = new Set(["-", "+", ".", ",", "e", "E"]);

// A whole number field: digits only, so decimals and negatives never get in.
export default function WholeInput({
  value,
  onValue,
  onKeyDown,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number | null;
  onValue: (n: number) => void;
}) {
  return (
    <Input
      {...props}
      type="number"
      step={1}
      inputMode="numeric"
      value={value ?? ""}
      onKeyDown={(e) => {
        if (NOT_DIGITS.has(e.key)) e.preventDefault();
        onKeyDown?.(e);
      }}
      onChange={(e) => {
        const text = e.target.value;
        if (/^\d*$/.test(text)) onValue(text === "" ? 0 : Number(text));
      }}
    />
  );
}
