"use client";
import TimeSelect from "@ee/components/push/composer/TimeSelect";
import StartEndRows from "@ee/components/shared/StartEndRows";
import type { ReactNode } from "react";
import { CalendarClock, Gauge, ListOrdered, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { InAppDraft } from "@ee/lib/inAppComposer";
import { ORIENTATION_LABELS } from "@ee/lib/inApp";
import { IN_APP_ORIENTATIONS } from "@ee/types/inApp";
import { Choice, NumberOrNone } from "@/components/composer/fields";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRIORITIES = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: i === 0 ? "1, lowest" : i === 9 ? "10, highest" : String(i + 1),
}));
const CAPS = [
  { key: "session", label: "in one visit", max: undefined },
  { key: "day", label: "in one day", max: 20 },
  { key: "week", label: "in one week", max: 20 },
  { key: "lifetime", label: "ever", max: undefined },
] as const;

export function Card({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-sidebar-border">
      <div className="flex items-start gap-2.5 border-b border-sidebar-border p-3.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          {icon}
        </span>
        <div>
          <h4 className="text-[13px] font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="space-y-4 p-3.5">{children}</div>
    </section>
  );
}

export default function LimitsSection({
  draft,
  set,
}: {
  draft: InAppDraft;
  set: (patch: Partial<InAppDraft>) => void;
}) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hours = draft.from !== "" || draft.to !== "";
  const restricted = draft.days.length > 0 || hours;
  const toggleDay = (day: number) =>
    set({
      days: draft.days.includes(day)
        ? draft.days.filter((d) => d !== day)
        : [...draft.days, day],
    });

  return (
    <div className="space-y-4">
      <Card
        icon={<Gauge className="size-3.5" />}
        title="How often one person sees it"
        hint="Leave a box empty for no limit. Counted on each device; the limit for ever also holds across a person's devices and a reinstall."
      >
        <div className="space-y-2">
          {CAPS.map((cap) => (
            <div key={cap.key} className="flex items-center gap-2 text-[13px]">
              <span className="w-16 text-muted-foreground">At most</span>
              <div className="w-24">
                <NumberOrNone
                  label={`Times ${cap.label}`}
                  max={cap.max}
                  value={draft.caps[cap.key]}
                  onChange={(value) =>
                    set({ caps: { ...draft.caps, [cap.key]: value } })
                  }
                />
              </div>
              <span>
                {draft.caps[cap.key] === 1 ? "time" : "times"} {cap.label}
              </span>
            </div>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 border-t border-sidebar-border pt-3.5 text-[13px]">
          <span>
            Not held back by the project limit
            <span className="block text-xs text-muted-foreground">
              The project limit caps all messages together (see Engagement
              Settings). With this on, this message skips that cap and is not
              counted by it. Its own limits above still apply.
            </span>
            {draft.caps.ignore_global && draft.priority < 10 && (
              <span className="mt-1 block text-xs text-amber-600 dark:text-amber-500">
                It can still lose to a message with a higher priority. Give it
                priority 10 if it must win.
              </span>
            )}
          </span>
          <Switch
            checked={draft.caps.ignore_global}
            onCheckedChange={(ignore_global) =>
              set({ caps: { ...draft.caps, ignore_global } })
            }
          />
        </label>
      </Card>

      <Card
        icon={<ListOrdered className="size-3.5" />}
        title="Priority"
        hint="When several messages match the same moment, only the one with the highest priority shows."
      >
        <Choice
          label="Priority"
          className="w-44"
          value={String(draft.priority)}
          options={PRIORITIES}
          onChange={(value) => set({ priority: Number(value) })}
        />
      </Card>

      <Card
        icon={<Smartphone className="size-3.5" />}
        title="Orientation"
        hint="A message for one orientation shows only while the screen is held that way, and closes if it turns. On the web, a browser window wider than it is tall counts as landscape."
      >
        <Choice
          label="Orientation"
          className="w-44"
          value={draft.orientation}
          options={IN_APP_ORIENTATIONS.map((value) => ({
            value,
            label: ORIENTATION_LABELS[value],
          }))}
          onChange={(orientation) => set({ orientation })}
        />
      </Card>

      <Card
        icon={<CalendarClock className="size-3.5" />}
        title="When it runs"
        hint={`Start and end are one moment for everyone, entered in your time zone (${zone}).`}
      >
        <StartEndRows
          start={draft.startAt}
          end={draft.endAt}
          onStart={(startAt) => set({ startAt })}
          onEnd={(endAt) => set({ endAt })}
        />

        <div className="space-y-3 border-t border-sidebar-border pt-3.5">
          <label className="flex items-center justify-between gap-3 text-[13px]">
            <span>
              Only on certain days or hours
              <span className="block text-xs text-muted-foreground">
                These follow the clock of each device, so 09:00 is 09:00 where
                the person is.
              </span>
            </span>
            <Switch
              checked={restricted}
              onCheckedChange={(on) =>
                set(
                  on
                    ? { days: [1, 2, 3, 4, 5], from: "09:00", to: "21:00" }
                    : { days: [], from: "", to: "" }
                )
              }
            />
          </label>
          {restricted && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((label, index) => {
                  const day = index + 1;
                  const on =
                    draft.days.length === 0 || draft.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        draft.days.length === 0
                          ? set({
                              days: [1, 2, 3, 4, 5, 6, 7].filter(
                                (d) => d !== day
                              ),
                            })
                          : toggleDay(day)
                      }
                      className={cn(
                        "w-12 rounded-md border py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-accent text-primary"
                          : "border-sidebar-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="w-12 text-muted-foreground">Hours</span>
                <Choice
                  label="Hours"
                  className="w-36"
                  value={draft.from || draft.to ? "between" : "all"}
                  options={[
                    { value: "all", label: "All day" },
                    { value: "between", label: "Between" },
                  ]}
                  onChange={(v) =>
                    set(
                      v === "all"
                        ? { from: "", to: "" }
                        : {
                            from: draft.from || "09:00",
                            to: draft.to || "21:00",
                          }
                    )
                  }
                />
                {(draft.from || draft.to) && (
                  <>
                    <TimeSelect
                      label="From"
                      value={draft.from}
                      onChange={(from) => set({ from })}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">and</span>
                    <TimeSelect
                      label="To"
                      value={draft.to}
                      onChange={(to) => set({ to })}
                      className="w-32"
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
