import { describe, expect, it } from "vitest";
import { OTHER_KEY } from "@/lib/metricQuery";
import type { MetricQueryRow } from "@/types";
import { lineSeries } from "../LineWidget";

const pts = (a: number, b: number) => [
  { date: "2026-09-01", value: a },
  { date: "2026-09-02", value: b },
];
const row = (key: string, a: number, b: number): MetricQueryRow => ({
  key,
  label: key,
  value: a + b,
  points: pts(a, b),
});
const data = (rows: MetricQueryRow[], other: MetricQueryRow | null) => ({
  metric: "installs",
  group_by: "country",
  rows,
  other,
  total: { value: 0 },
});

describe("lineSeries", () => {
  it("keeps up to five rows as they are, with the backend Other", () => {
    const rows = ["a", "b", "c"].map((k) => row(k, 1, 2));
    const other = { ...row(OTHER_KEY, 5, 5) };
    expect(lineSeries(data(rows, other))).toEqual([...rows, other]);
    expect(lineSeries(data(rows, null))).toEqual(rows);
  });

  it("renders rows and the backend Other as-is, never summing rows into Other", () => {
    const rows = ["a", "b", "c", "d", "e"].map((k) => row(k, 1, 2));
    const other = row(OTHER_KEY, 4, 4);
    expect(lineSeries(data(rows, other))).toEqual([...rows, other]);
  });
});
