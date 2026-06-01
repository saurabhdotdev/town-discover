import { z } from "zod/v3";

export const getCrowdReportsSchema = z.object({
  query: z.object({
    placeId: z.string().trim().optional(),
    placeIds: z.string().trim().optional(),
  }),
});

export const postCrowdReportSchema = z.object({
  body: z.object({
    placeId: z.string({ required_error: "placeId is required." }).trim().min(1, "placeId is required."),
    crowdLevel: z.enum(["low", "moderate", "busy", "very_crowded"], {
      errorMap: () => ({ message: "crowdLevel must be 'low', 'moderate', 'busy', or 'very_crowded'." }),
    }),
    note: z
      .string()
      .trim()
      .max(180, "Note must be at most 180 characters.")
      .optional()
      .nullable()
      .transform((val) => val || ""),
  }),
});

export type GetCrowdReportsInput = z.infer<typeof getCrowdReportsSchema>;
export type PostCrowdReportInput = z.infer<typeof postCrowdReportSchema>;
