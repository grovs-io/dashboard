import { format } from "date-fns";
import type { InAppAnswerRow, InAppQuestionType } from "@ee/types/inApp";

const HEADERS = [
  "Date (local)",
  "Answer",
  "Comment",
  "User",
  "Platform",
  "Country",
  "App version",
];

// A spreadsheet runs a cell that starts with one of these as a formula.
const cell = (value: string) =>
  `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

// Starts with a byte order mark, so spreadsheets read accents and emoji.
// Dates are in the local time of whoever exports, as the header says.
export function answersCsv(
  type: InAppQuestionType,
  rows: InAppAnswerRow[]
): string {
  const lines = rows.map((row) => [
    format(new Date(row.at), "yyyy-MM-dd HH:mm"),
    type === "stars" ? row.answer : row.label,
    row.comment,
    row.user ?? "",
    row.platform,
    row.country,
    row.app_version,
  ]);
  return (
    "﻿" +
    [HEADERS, ...lines]
      .map((line) => line.map((value) => cell(value ?? "")).join(","))
      .join("\r\n")
  );
}

export function answersFileName(name: string, from: string, to: string) {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe || "campaign"}-answers-${from}-to-${to}.csv`;
}
