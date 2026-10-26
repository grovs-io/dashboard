import { z } from "zod";
import { httpsUrlSchema } from "./shared";

// Mirrors PushCampaign::MAX_DATA_BYTES.
export const MAX_DATA_BYTES = 2048;
const encoder = new TextEncoder();

export function dataBytes(data: Record<string, unknown> | undefined): number {
  return encoder.encode(JSON.stringify(data ?? {})).length;
}

export const RESERVED_KEY_MESSAGE =
  "Keys starting with grovs_ are reserved for Grovs. Pick another key.";

export function reservedDataKey(key: string): boolean {
  return /^grovs_/.test(key);
}

export const pushDataRowSchema = z.object({
  key: z.string(),
  value: z.string(),
  original: z.unknown().optional(),
});

export type PushDataRow = z.infer<typeof pushDataRowSchema>;

export function dataRowsToObject(rows: PushDataRow[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    const unchanged =
      row.original !== undefined && row.value === JSON.stringify(row.original);
    data[key] = unchanged ? row.original : row.value;
  }
  return data;
}

export const pushContentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Add a title: the bold first line people see.")
      .max(255, "The title is too long: at most 255 characters."),
    body: z
      .string()
      .trim()
      .min(1, "Add the message: the text people see under the title.")
      .max(1000, "The message is too long: at most 1000 characters."),
    imageUrl: z.union([
      z.literal(""),
      httpsUrlSchema.pipe(
        z
          .string()
          .max(2048, "The image link is too long: at most 2048 characters.")
      ),
    ]),
    soundMode: z.enum(["default", "silent", "custom"]),
    sound: z
      .string()
      .max(64, "The sound name is too long: at most 64 characters."),
    linkId: z.number().nullable(),
    data: z.array(pushDataRowSchema),
  })
  .superRefine((values, ctx) => {
    if (values.soundMode === "custom" && !values.sound.trim())
      ctx.addIssue({
        code: "custom",
        path: ["sound"],
        message: "Enter the sound file name, such as chime.caf.",
      });
    const seen = new Set<string>();
    values.data.forEach((row, index) => {
      const key = row.key.trim();
      const path = ["data", index, "key"];
      if (!key) {
        if (row.value)
          ctx.addIssue({
            code: "custom",
            path,
            message: "This row has no key. Add a key or remove the row.",
          });
        return;
      }
      if (reservedDataKey(key))
        ctx.addIssue({
          code: "custom",
          path,
          message: RESERVED_KEY_MESSAGE,
        });
      else if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path,
          message: "This key is used twice. Each key can appear only once.",
        });
      seen.add(key);
    });
    if (dataBytes(dataRowsToObject(values.data)) > MAX_DATA_BYTES)
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message:
          "Custom data is too large: at most 2 KB in total. Remove some keys or shorten values.",
      });
  });

export type PushContentFormValues = z.infer<typeof pushContentSchema>;
