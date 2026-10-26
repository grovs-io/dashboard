import { describe, it, expect } from "vitest";
import {
  pct,
  formatAxisNumber,
  formatCompactNumber,
  numberFormatter,
} from "../metricFormat";

describe("metricFormat", () => {
  it("pct returns 0 when the previous value is 0", () => {
    expect(pct(10, 0)).toBe(0);
  });

  it("pct rounds the relative change", () => {
    expect(pct(150, 100)).toBe(50);
    expect(pct(50, 100)).toBe(-50);
    expect(pct(3, 2)).toBe(50);
  });

  it("formatAxisNumber abbreviates thousands and millions", () => {
    expect(formatAxisNumber(999)).toBe("999");
    expect(formatAxisNumber(1500)).toBe("1.5K");
    expect(formatAxisNumber(12000)).toBe("12K");
    expect(formatAxisNumber(2_000_000)).toBe("2M");
    expect(formatAxisNumber("abc")).toBe("abc");
  });

  it("numberFormatter uses de-DE grouping", () => {
    expect(numberFormatter.format(1234567)).toBe("1.234.567");
  });

  it("formatCompactNumber keeps one decimal for millions and trims .0", () => {
    expect(formatCompactNumber(19_610_164)).toBe("19.6M");
    expect(formatCompactNumber(2_000_000)).toBe("2M");
    expect(formatCompactNumber(19_500)).toBe("20K");
    expect(formatCompactNumber(1_500)).toBe("1.5K");
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(999_950)).toBe("1M");
    expect(formatCompactNumber(999_400)).toBe("999K");
  });
});
