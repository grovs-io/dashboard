import { z } from "zod";

export const segmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or fewer"),
});

export type SegmentFormValues = z.infer<typeof segmentSchema>;
