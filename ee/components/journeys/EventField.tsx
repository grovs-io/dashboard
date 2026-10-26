"use client";
import { Filters } from "@ee/components/in_app/composer/TriggerSection";
import { useInAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import type { JourneyEvent } from "@ee/types/journey";
import EventPicker from "./EventPicker";

// A built-in event, a custom event or a screen; all but built-in events take property filters.
export default function EventField({
  projectId,
  label,
  value,
  onChange,
}: {
  projectId: string;
  label: string;
  value: JourneyEvent | null;
  onChange: (value: JourneyEvent) => void;
}) {
  const suggestions = useInAppSuggestions(projectId);
  const custom = !value?.system;
  return (
    <div className="space-y-3">
      <EventPicker
        projectId={projectId}
        label={label}
        value={value}
        onChange={onChange}
      />
      {custom && (
        <Filters
          filters={value?.filters ?? []}
          properties={suggestions.eventProperties}
          onChange={(filters) => onChange({ ...value, filters })}
        />
      )}
    </div>
  );
}
