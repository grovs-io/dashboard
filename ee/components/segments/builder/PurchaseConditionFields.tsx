"use client";
import { Input } from "@/components/ui/input";
import { catalogueEntry, windowCapDays } from "@ee/lib/segments";
import type { PurchaseCondition, SegmentCatalogue } from "@ee/types/segments";
import { Pick, Word, humanize } from "./InlineControls";
import ValuePicker from "./ValuePicker";
import WindowPicker from "./WindowPicker";

interface Props {
  projectId: string;
  condition: PurchaseCondition;
  catalogue: SegmentCatalogue;
  onChange: (condition: PurchaseCondition) => void;
}

export default function PurchaseConditionFields({
  projectId,
  condition,
  catalogue,
  onChange,
}: Props) {
  const entry = catalogueEntry(catalogue, "purchase");
  const types = entry?.purchase_types ?? [];
  const typeValue =
    condition.purchase_type?.length === 1 ? condition.purchase_type[0]! : "any";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry?.negatable !== false && (
        <Pick
          ariaLabel="Purchased or did not purchase"
          value={condition.negate ? "not" : "did"}
          onChange={(v) =>
            onChange({ ...condition, negate: v === "not" ? true : undefined })
          }
          options={[
            { value: "did", label: "bought" },
            { value: "not", label: "did not buy" },
          ]}
        />
      )}
      {types.length > 0 && (
        <Pick
          ariaLabel="Purchase type"
          value={typeValue}
          onChange={(v) =>
            onChange({
              ...condition,
              purchase_type: v === "any" ? undefined : [v],
            })
          }
          options={[
            { value: "any", label: "any type" },
            ...types.map((t) => ({ value: t, label: humanize(t) })),
          ]}
        />
      )}
      <Pick
        ariaLabel="Store"
        value={
          condition.store_source?.length === 1
            ? condition.store_source[0]!
            : "any"
        }
        onChange={(v) =>
          onChange({
            ...condition,
            store_source: v === "any" ? undefined : [v],
          })
        }
        options={[
          { value: "any", label: "on any store" },
          { value: "apple", label: "on the App Store" },
          { value: "google", label: "on Google Play" },
        ]}
      />
      <ValuePicker
        projectId={projectId}
        field="purchase.product_id"
        values={condition.product_id ?? []}
        onChange={(product_id) =>
          onChange({
            ...condition,
            product_id: product_id.length ? product_id : undefined,
          })
        }
        ariaLabel="Product ids"
        maxValues={catalogue.limits.values}
        placeholder="any product"
      />
      <Word>at least</Word>
      <Input
        type="number"
        aria-label="Minimum purchases"
        className="h-8 w-16"
        min={1}
        value={condition.count ?? 1}
        onChange={(e) =>
          onChange({
            ...condition,
            count: Math.max(1, Number(e.target.value) || 1),
          })
        }
      />
      <Word>{(condition.count ?? 1) === 1 ? "time" : "times"}</Word>
      <Word>totalling ≥ $</Word>
      <Input
        type="number"
        aria-label="Minimum total USD"
        className="h-8 w-24"
        min={0}
        step="0.01"
        placeholder="any"
        value={
          condition.min_total_usd_cents !== undefined
            ? (condition.min_total_usd_cents / 100).toString()
            : ""
        }
        onChange={(e) =>
          onChange({
            ...condition,
            min_total_usd_cents:
              e.target.value === ""
                ? undefined
                : Math.max(0, Math.round(Number(e.target.value) * 100)),
          })
        }
      />
      <WindowPicker
        value={condition.window}
        capDays={windowCapDays("purchase", catalogue)}
        onChange={(window) => onChange({ ...condition, window })}
      />
    </div>
  );
}
