import { describe, expect, it } from "vitest";
import {
  parseRecipients,
  parseRecipientsCsv,
  recipientsLabel,
  segmentLabel,
} from "../audience";

describe("parseRecipients", () => {
  it("splits on newlines and commas, trims, and drops empties", () => {
    const { recipients, dropped } = parseRecipients(
      "  a \n b,c\n\n , d , \n a"
    );
    expect(recipients).toEqual(["a", "b", "c", "d"]);
    expect(dropped).toBe(1); // the trailing duplicate "a"
  });

  it("de-duplicates", () => {
    const { recipients, dropped } = parseRecipients("x\nx\nx\ny");
    expect(recipients).toEqual(["x", "y"]);
    expect(dropped).toBe(2);
  });

  it("caps at 10,000 and reports how many were dropped", () => {
    const values = Array.from({ length: 10_005 }, (_, i) => `id${i}`);
    const { recipients, dropped } = parseRecipients(values.join("\n"));
    expect(recipients).toHaveLength(10_000);
    expect(dropped).toBe(5);
  });

  it("returns an empty result for blank input", () => {
    expect(parseRecipients("   \n \n ")).toEqual({
      recipients: [],
      dropped: 0,
    });
  });
});

describe("parseRecipientsCsv", () => {
  const csvFile = (content: string) =>
    new File([content], "recipients.csv", { type: "text/csv" });

  it("reads the first column and skips an identifier header", async () => {
    const file = csvFile("identifier,name\nuser_1,Ann\nuser_2,Bo");
    const { recipients } = await parseRecipientsCsv(file);
    expect(recipients).toEqual(["user_1", "user_2"]);
  });

  it("reads the first column and skips a uuid header", async () => {
    const file = csvFile("uuid\n550e8400-e29b-41d4-a716-446655440001");
    const { recipients } = await parseRecipientsCsv(file);
    expect(recipients).toEqual(["550e8400-e29b-41d4-a716-446655440001"]);
  });

  it("treats the first row as data when the header doesn't read identifier/uuid", async () => {
    const file = csvFile("user_1\nuser_2");
    const { recipients } = await parseRecipientsCsv(file);
    expect(recipients).toEqual(["user_1", "user_2"]);
  });

  it("de-duplicates and caps like parseRecipients", async () => {
    const file = csvFile("identifier\nuser_1\nuser_1\nuser_2");
    const { recipients, dropped } = await parseRecipientsCsv(file);
    expect(recipients).toEqual(["user_1", "user_2"]);
    expect(dropped).toBe(1);
  });
});

describe("recipientsLabel", () => {
  it("pluralises user ids and devices", () => {
    expect(recipientsLabel("identifiers", 1)).toBe("1 user id");
    expect(recipientsLabel("identifiers", 1200)).toBe("1,200 user ids");
    expect(recipientsLabel("visitors", 1)).toBe("1 device");
    expect(recipientsLabel("visitors", 0)).toBe("0 devices");
  });
});

describe("segmentLabel", () => {
  it("names the segment, with one fallback", () => {
    expect(segmentLabel("Buyers")).toBe("Segment: Buyers");
    expect(segmentLabel(undefined)).toBe("Segment: Unknown segment");
    expect(segmentLabel("")).toBe("Segment: Unknown segment");
  });
});
