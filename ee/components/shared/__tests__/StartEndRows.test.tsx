import { describe, expect, it } from "vitest";
import { useState } from "react";
import { addDays, format } from "date-fns";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { polyfillDom } from "@ee/components/push/composer/__tests__/helpers";
import StartEndRows from "../StartEndRows";

const at9 = (days: number) =>
  `${format(addDays(new Date(), days), "yyyy-MM-dd")}T09:00`;
const shown = (days: number) =>
  format(addDays(new Date(), days), "EEE, d MMM yyyy");

function Harness({ initial = ["", ""] }: { initial?: [string, string] }) {
  const [start, setStart] = useState(initial[0]);
  const [end, setEnd] = useState(initial[1]);
  return (
    <>
      <StartEndRows start={start} end={end} onStart={setStart} onEnd={setEnd} />
      <output data-testid="value">{`${start}|${end}`}</output>
    </>
  );
}
const value = () => screen.getByTestId("value").textContent;
const choose = async (row: "Start" | "End", option: string) => {
  await userEvent.click(screen.getByRole("combobox", { name: row }));
  await userEvent.click(screen.getByRole("option", { name: option }));
};

describe("StartEndRows", () => {
  it("starts at launch and runs until ended, with no date shown", () => {
    polyfillDom();
    render(<Harness />);
    expect(screen.getByRole("combobox", { name: "Start" })).toHaveTextContent(
      "As soon as it's launched"
    );
    expect(screen.getByRole("combobox", { name: "End" })).toHaveTextContent(
      "Until I end it"
    );
    expect(screen.queryByRole("button", { name: "Start date" })).toBeNull();
  });

  it("defaults a start to tomorrow 09:00 and an end to a week after it, with quick picks", async () => {
    polyfillDom();
    render(<Harness />);
    await choose("Start", "On a date");
    expect(value()).toBe(`${at9(1)}|`);
    expect(
      screen.getByRole("button", { name: "Start date" })
    ).toHaveTextContent(shown(1));
    expect(
      screen.getByRole("combobox", { name: "Start time" })
    ).toHaveTextContent("09:00");
    await choose("End", "On a date");
    expect(value()).toBe(`${at9(1)}|${at9(8)}`);
    await userEvent.click(
      screen.getByRole("button", { name: "30 days after start" })
    );
    expect(value()).toBe(`${at9(1)}|${at9(31)}`);
    await choose("End", "Until I end it");
    expect(value()).toBe(`${at9(1)}|`);
  });

  it("flags an end that is not after the start", () => {
    polyfillDom();
    render(<Harness initial={[at9(5), at9(2)]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "End must be after the start."
    );
  });
});
