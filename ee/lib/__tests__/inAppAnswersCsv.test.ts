import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { answersCsv, answersFileName } from "../inAppAnswersCsv";
import type { InAppAnswerRow } from "@ee/types/inApp";

const row = (over: Partial<InAppAnswerRow> = {}): InAppAnswerRow => ({
  at: "2026-09-20T10:00:00Z",
  platform: "ios",
  country: "RO",
  app_version: "2.1.0",
  answer: "4",
  label: "4",
  comment: "",
  user: null,
  ...over,
});

const local = (iso: string) => format(new Date(iso), "yyyy-MM-dd HH:mm");
const lines = (csv: string) => csv.slice(1).split("\r\n");

describe("answersCsv", () => {
  it("starts with a byte order mark and the headers, which say the time is local", () => {
    const csv = answersCsv("stars", []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines(csv)).toEqual([
      '"Date (local)","Answer","Comment","User","Platform","Country","App version"',
    ]);
  });

  it("stars: the number of stars, the local time, and nothing for what is missing", () => {
    expect(lines(answersCsv("stars", [row()]))[1]).toBe(
      `"${local("2026-09-20T10:00:00Z")}","4","","","ios","RO","2.1.0"`
    );
  });

  it("choices: the text of the option, not its id", () => {
    const csv = answersCsv("choice", [
      row({ answer: "friend", label: "A friend", user: "ana" }),
    ]);
    expect(lines(csv)[1]).toContain('"A friend","","ana"');
    expect(csv).not.toContain('"friend"');
  });

  it("doubles quotes and keeps line breaks inside a comment", () => {
    const csv = answersCsv("stars", [
      row({ comment: 'She said "slow",\nthen left' }),
    ]);
    expect(csv).toContain('"She said ""slow"",\nthen left"');
    expect(csv.slice(1).split("\r\n")).toHaveLength(2);
  });

  it("keeps accents and emoji", () => {
    expect(answersCsv("stars", [row({ comment: "Îmi place 👍" })])).toContain(
      '"Îmi place 👍"'
    );
  });

  it("stops a field from being run as a formula", () => {
    const csv = answersCsv("choice", [
      row({ label: "=1+1", comment: "+40 722", user: "@ana" }),
      row({ label: "-2", comment: "fine = good" }),
    ]);
    expect(lines(csv)[1]).toContain(`"'=1+1","'+40 722","'@ana"`);
    expect(lines(csv)[2]).toContain(`"'-2","fine = good"`);
  });

  it("also guards a field that starts with a tab or a carriage return", () => {
    const csv = answersCsv("choice", [
      row({ label: "\t=1+1", comment: "\r=2+2", user: "\n=3" }),
    ]);
    expect(lines(csv)[1]).toContain(`"'\t=1+1","'\r=2+2","\n=3"`);
  });
});

describe("answersFileName", () => {
  it("is the name made safe, then the period", () => {
    expect(answersFileName("Rate the app", "2026-09-16", "2026-09-29")).toBe(
      "rate-the-app-answers-2026-09-16-to-2026-09-29.csv"
    );
    expect(
      answersFileName("Demo: How did you find us?", "2026-09-01", "2026-09-02")
    ).toBe("demo-how-did-you-find-us-answers-2026-09-01-to-2026-09-02.csv");
    expect(answersFileName("../?", "2026-09-01", "2026-09-02")).toBe(
      "campaign-answers-2026-09-01-to-2026-09-02.csv"
    );
  });
});
