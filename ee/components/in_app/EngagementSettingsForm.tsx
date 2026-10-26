"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  BellRing,
  FlaskConical,
  Gauge,
  Power,
  Save,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import { inAppErrorText } from "@ee/lib/inApp";
import { useUpdateInAppSettings } from "@ee/hooks/mutations/useInAppMutations";
import { Choice, NumberOrNone } from "@/components/composer/fields";
import { PROJECT_CONTROL_GROUPS } from "@ee/lib/inAppComposer";
import type { InAppSettings } from "@ee/types/inApp";

interface Props {
  projectId: string;
  settings: InAppSettings;
}

type Editing = Omit<InAppSettings, "session_cap" | "day_cap"> & {
  session_cap: number | null;
  day_cap: number | null;
};

const LIMITS = [
  { key: "session_cap", label: "in one visit" },
  { key: "day_cap", label: "in one day" },
] as const;
// The backend accepts 1 to 50; empty means no limit.
const PUSH_CAP_MAX = 50;
const CONTROL = PROJECT_CONTROL_GROUPS.map((n) => ({
  value: String(n),
  label: n === 0 ? "No one held back" : `${n}% held back`,
}));

// The project's engagement settings, shared by push, in-app messages and journeys.
export default function EngagementSettingsForm({ projectId, settings }: Props) {
  // A limit may be empty while it is being typed; it cannot be saved that way.
  const [value, setValue] = useState<Editing>(settings);
  const [seen, setSeen] = useState(settings);
  const update = useUpdateInAppSettings(projectId);
  const edited =
    LIMITS.some((l) => value[l.key] !== seen[l.key]) ||
    value.enabled !== seen.enabled ||
    value.control_group !== seen.control_group ||
    (value.push_daily_cap ?? null) !== (seen.push_daily_cap ?? null);
  // What the server holds changed: follow it, unless something here is being edited.
  if (seen !== settings) {
    setSeen(settings);
    if (!edited) setValue(settings);
  }
  const dirty =
    LIMITS.some((l) => value[l.key] !== settings[l.key]) ||
    value.enabled !== settings.enabled ||
    value.control_group !== settings.control_group ||
    (value.push_daily_cap ?? null) !== (settings.push_daily_cap ?? null);

  const incomplete = LIMITS.some((l) => value[l.key] === null);

  const save = async () => {
    try {
      await update.mutateAsync({
        enabled: value.enabled,
        session_cap: value.session_cap ?? settings.session_cap,
        day_cap: value.day_cap ?? settings.day_cap,
        control_group: value.control_group,
        push_daily_cap: value.push_daily_cap ?? null,
      });
      showSuccessNotification("Settings saved");
    } catch (error) {
      showErrorNotification(
        inAppErrorText(error, "Could not save the settings")
      );
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between overflow-hidden bg-sidebar/80 px-6 backdrop-blur-md transition-all duration-300",
          dirty
            ? "max-h-16 border-b border-sidebar-border py-3 opacity-100"
            : "max-h-0 border-b-0 py-0 opacity-0"
        )}
      >
        {dirty && (
          <>
            <span className="text-xs text-muted-foreground">
              Unsaved changes in Engagement Settings
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="pl-3 pr-4"
                onClick={() => setValue(settings)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Discard
              </Button>
              <Button
                size="sm"
                className="pl-3 pr-4"
                disabled={incomplete || update.isPending}
                onClick={() => void save()}
              >
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex max-w-[800px] flex-col px-6 pt-6 pb-16">
        <div className="mb-7">
          <h2 className="text-[18px] font-semibold tracking-tight">
            Engagement Settings
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Shared by push campaigns, in-app messages and journeys in this
            project.
          </p>
        </div>

        <div className="flex flex-col divide-y divide-sidebar-border">
          <Section
            icon={FlaskConical}
            title="Control group"
            description="Hold back a share of people from every in-app message and push. Comparing them with everyone else shows what your messages actually change."
          >
            <Choice
              label="Control group"
              className="w-48"
              value={String(value.control_group)}
              options={CONTROL}
              onChange={(n) => setValue({ ...value, control_group: Number(n) })}
            />
            <p className="text-xs text-muted-foreground">
              {value.control_group > 0
                ? `${value.control_group}% of people receive no in-app messages or pushes at all; the other ${100 - value.control_group}% get them as usual.`
                : "Everyone can receive messages, so there is no baseline to compare results against."}
            </p>
          </Section>

          <Section
            icon={BellRing}
            title="Pushes per person per day"
            description="Applies to every push: campaigns and journeys."
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="w-16 text-muted-foreground">At most</span>
              <div className="w-24">
                <NumberOrNone
                  label="Pushes per person per day"
                  max={PUSH_CAP_MAX}
                  value={value.push_daily_cap ?? null}
                  onChange={(n) => setValue({ ...value, push_daily_cap: n })}
                />
              </div>
              <span>pushes in one day</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty for no limit. Up to {PUSH_CAP_MAX}.
            </p>
          </Section>

          <Section
            icon={Power}
            title="In-app messages"
            description={
              value.enabled
                ? "On. Switch off to stop every message at once; campaigns keep their state."
                : "Off. No device shows any message; devices in use stop within about a minute."
            }
            aside={
              <Switch
                id="in-app-enabled"
                aria-label="In-app messages"
                checked={value.enabled}
                onCheckedChange={(enabled) => setValue({ ...value, enabled })}
              />
            }
          />

          <Section
            icon={Gauge}
            title="Limit on in-app messages together"
            description="So one person is never shown too many, however many campaigns run. A campaign can be set to ignore it."
          >
            {LIMITS.map((limit) => (
              <div key={limit.key} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-muted-foreground">At most</span>
                <div className="w-24">
                  <NumberOrNone
                    label={`Messages ${limit.label}`}
                    max={1000}
                    placeholder="10"
                    value={value[limit.key]}
                    onChange={(n) => setValue({ ...value, [limit.key]: n })}
                  />
                </div>
                <span>messages {limit.label}</span>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 py-6 first:pt-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        </div>
        {aside}
      </div>
      {children && (
        <div className="flex flex-col gap-2 sm:pl-13">{children}</div>
      )}
    </section>
  );
}
