import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { addDays, format } from "date-fns";
import { viewerTimeZone } from "@ee/lib/push";
import { defaultSchedule, type ScheduleValue } from "@ee/lib/pushComposer";
import DeliverySection from "../DeliverySection";
import { polyfillDom } from "./helpers";

const seen = vi.fn();

function Harness({ initial }: { initial: ScheduleValue }) {
  const [value, setValue] = useState(initial);
  return (
    <DeliverySection
      value={value}
      onChange={(v) => {
        seen(v);
        setValue(v);
      }}
      showErrors
    />
  );
}

const scheduled = (over: Partial<ScheduleValue>): ScheduleValue => ({
  ...defaultSchedule(),
  mode: "schedule",
  ...over,
});

beforeEach(() => polyfillDom());

describe("DeliverySection", () => {
  it("refuses a time in the past", () => {
    render(
      <Harness
        initial={scheduled({
          date: format(addDays(new Date(), -1), "yyyy-MM-dd"),
        })}
      />
    );
    expect(
      screen.getByText("Schedule must be in the future.")
    ).toBeInTheDocument();
  });

  it("refuses a time more than 30 days ahead", () => {
    render(
      <Harness
        initial={scheduled({
          date: format(addDays(new Date(), 40), "yyyy-MM-dd"),
        })}
      />
    );
    expect(
      screen.getByText("Schedule must be within 30 days.")
    ).toBeInTheDocument();
  });

  it("needs 14 hours' notice for local-time delivery in UTC", () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    render(
      <Harness
        initial={scheduled({
          localTime: true,
          timezone: "UTC",
          date: soon.slice(0, 10),
          time: soon.slice(11, 16),
        })}
      />
    );
    expect(
      screen.getByText(
        "Local-time delivery needs at least 14 hours' notice in this timezone."
      )
    ).toBeInTheDocument();
  });

  it("does not promise a fixed notice period for local time", () => {
    render(
      <Harness
        initial={scheduled({
          localTime: true,
          date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
        })}
      />
    );
    expect(
      screen.getByText(/sets how much notice it needs/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Needs 14 hours/)).not.toBeInTheDocument();
  });

  it("defaults the timezone to the viewer's zone when local time is switched on", async () => {
    render(
      <Harness
        initial={scheduled({
          date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
        })}
      />
    );
    expect(
      screen.queryByRole("combobox", { name: "Timezone" })
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("switch", { name: "Deliver in each user's local time" })
    );
    expect(
      screen.getByRole("combobox", { name: "Timezone" })
    ).toHaveTextContent(viewerTimeZone());
    expect(screen.getByText(/in each user's timezone/)).toBeInTheDocument();
  });

  it("shows no date controls for send now", () => {
    render(<Harness initial={defaultSchedule()} />);
    expect(
      screen.queryByRole("button", { name: "Date" })
    ).not.toBeInTheDocument();
  });

  it("sets the date and time from the Tomorrow 09:00 preset and summarises it", async () => {
    render(<Harness initial={scheduled({ timezone: "UTC" })} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Tomorrow 09:00" })
    );
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ date: tomorrow, time: "09:00" })
    );
    expect(screen.getByRole("button", { name: "Date" })).toHaveTextContent(
      format(addDays(new Date(), 1), "EEE, d MMM yyyy")
    );
    expect(
      screen.getByText(
        new RegExp(
          `^Sends ${format(addDays(new Date(), 1), "EEE, d MMM")} at 09:00 `
        )
      )
    ).toBeInTheDocument();
  });

  it("disables the In 1 hour preset when local time needs more notice", async () => {
    render(
      <Harness initial={scheduled({ localTime: true, timezone: "UTC" })} />
    );
    expect(screen.getByRole("button", { name: "In 1 hour" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Tomorrow 09:00" })
    ).toBeInTheDocument();
  });

  it("disables past days and days more than 30 days out", async () => {
    render(<Harness initial={scheduled({})} />);
    await userEvent.click(screen.getByRole("button", { name: "Date" }));
    const day = (d: Date) =>
      document.querySelector(`button[data-day="${d.toLocaleDateString()}"]`);
    const yesterday = addDays(new Date(), -1);
    const tooFar = addDays(new Date(), 31);
    const tomorrow = addDays(new Date(), 1);
    if (day(yesterday)) expect(day(yesterday)).toBeDisabled();
    expect(day(tomorrow)).not.toBeDisabled();
    if (day(tooFar)) expect(day(tooFar)).toBeDisabled();
    expect(day(yesterday) ?? day(tooFar)).not.toBeNull();
  });

  it("accepts a typed time that is not on the 15-minute list", async () => {
    render(
      <Harness
        initial={scheduled({
          date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
        })}
      />
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Time" }));
    await userEvent.type(
      screen.getByPlaceholderText("Type a time, e.g. 09:07"),
      "9:07"
    );
    await userEvent.click(screen.getByRole("option", { name: /Use 09:07/ }));
    expect(seen).toHaveBeenLastCalledWith(
      expect.objectContaining({ time: "09:07" })
    );
    expect(screen.getByRole("combobox", { name: "Time" })).toHaveTextContent(
      "09:07"
    );
  });

  it("is a two-option radio control driven by the arrow keys", async () => {
    render(<Harness initial={defaultSchedule()} />);
    expect(
      screen.getByRole("radiogroup", { name: "Delivery" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Starts going out a few seconds after you confirm.")
    ).toBeInTheDocument();
    screen.getByRole("radio", { name: "Send now" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Schedule" })).toBeChecked();
    expect(
      screen.getByText("Pick a time up to 30 days ahead.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Date" })).toBeInTheDocument();
  });
});
