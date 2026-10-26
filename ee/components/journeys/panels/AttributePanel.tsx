"use client";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/composer/fields";
import type { SetAttributeStep } from "@ee/types/journey";

export default function AttributePanel({
  step,
  locked,
  onChange,
}: {
  step: SetAttributeStep;
  locked: boolean;
  onChange: (step: SetAttributeStep) => void;
}) {
  return (
    <div className="space-y-5">
      <Field
        label="Key"
        hint="Starts with journey_, so it never clashes with what your app sets."
      >
        {(id) => (
          <Input
            id={id}
            disabled={locked}
            maxLength={48}
            value={step.key}
            onChange={(e) =>
              onChange({ ...step, key: e.target.value.toLowerCase() })
            }
          />
        )}
      </Field>
      <Field label="Value" hint="Segments and splits can check it later.">
        {(id) => (
          <Input
            id={id}
            maxLength={255}
            value={step.value}
            onChange={(e) => onChange({ ...step, value: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
