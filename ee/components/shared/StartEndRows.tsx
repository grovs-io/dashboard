"use client";
import { addDays, format, nextMonday, parse } from "date-fns";
import { Choice } from "@/components/composer/fields";
import DateTimeField from "./DateTimeField";

const STAMP = "yyyy-MM-dd'T'HH:mm";
const at9 = (d: Date) => `${format(d, "yyyy-MM-dd")}T09:00`;
const read = (v: string) => parse(v, STAMP, new Date());

// Tomorrow 09:00; an end defaults to a week after the start (or after now).
export const defaultStart = () => at9(addDays(new Date(), 1));
export const defaultEnd = (start: string) =>
  at9(addDays(start ? read(start) : new Date(), 7));

// When something starts and ends: a choice per row, and a date and time only once one is picked.
// Values are "yyyy-MM-ddTHH:mm"; "" means at launch / until ended by hand.
export default function StartEndRows({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}) {
  const base = start ? read(start) : new Date();
  const endBeforeStart = !!start && !!end && read(end) <= read(start);
  const row = "grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2";
  return (
    <div className="space-y-4">
      <div className={row}>
        <span className="pt-2 text-[13px] font-medium">Start</span>
        <Choice
          label="Start"
          className="w-full max-w-md"
          value={start ? "date" : "launch"}
          options={[
            { value: "launch", label: "As soon as it's launched" },
            { value: "date", label: "On a date" },
          ]}
          onChange={(v) =>
            onStart(v === "launch" ? "" : start || defaultStart())
          }
        />
        {start && (
          <div className="col-start-2 max-w-md">
            <DateTimeField
              label="Start"
              value={start}
              onChange={onStart}
              presets={[
                { label: "Tomorrow 9:00", value: at9(addDays(new Date(), 1)) },
                {
                  label: "Next Monday 9:00",
                  value: at9(nextMonday(new Date())),
                },
              ]}
            />
          </div>
        )}
      </div>
      <div className={row}>
        <span className="pt-2 text-[13px] font-medium">End</span>
        <Choice
          label="End"
          className="w-full max-w-md"
          value={end ? "date" : "never"}
          options={[
            { value: "never", label: "Until I end it" },
            { value: "date", label: "On a date" },
          ]}
          onChange={(v) => onEnd(v === "never" ? "" : end || defaultEnd(start))}
        />
        {end && (
          <div className="col-start-2 max-w-md space-y-1.5">
            <DateTimeField
              label="End"
              value={end}
              onChange={onEnd}
              invalid={endBeforeStart}
              presets={[
                {
                  label: `1 week ${start ? "after start" : "from now"}`,
                  value: at9(addDays(base, 7)),
                },
                {
                  label: `2 weeks ${start ? "after start" : "from now"}`,
                  value: at9(addDays(base, 14)),
                },
                {
                  label: `30 days ${start ? "after start" : "from now"}`,
                  value: at9(addDays(base, 30)),
                },
              ]}
            />
            {endBeforeStart && (
              <p role="alert" className="text-xs text-destructive">
                End must be after the start.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
