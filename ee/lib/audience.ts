// Channel-neutral: shared by the push composer and (later) the in-app Messaging composer.
export const MAX_RECIPIENTS = 10_000;

export interface ParsedRecipients {
  recipients: string[];
  dropped: number;
}

export function parseRecipients(text: string): ParsedRecipients {
  const trimmed = text
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const unique = Array.from(new Set(trimmed));
  const recipients = unique.slice(0, MAX_RECIPIENTS);
  return {
    recipients,
    dropped: trimmed.length - recipients.length,
  };
}

// First column; a header row is skipped only when it reads "identifier" or "uuid".
export async function parseRecipientsCsv(
  file: File
): Promise<ParsedRecipients> {
  const text = await file.text();
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
  const firstCell = (line: string) =>
    (line.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  const header = firstCell(lines[0] ?? "").toLowerCase();
  const rows =
    header === "identifier" || header === "uuid" ? lines.slice(1) : lines;
  return parseRecipients(rows.map(firstCell).join("\n"));
}

export function recipientsLabel(
  type: "identifiers" | "visitors",
  count: number
): string {
  const noun = type === "identifiers" ? "user id" : "device";
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

export function segmentLabel(name: string | null | undefined): string {
  return `Segment: ${name || "Unknown segment"}`;
}
