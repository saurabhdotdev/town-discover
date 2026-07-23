import { z } from "zod";

const placeIdRegex = /^[a-zA-Z0-9:_-]{1,120}$/;

export const getCrowdReportsSchema = z.object({
  query: z.object({
    placeId: z.string().trim().regex(placeIdRegex, "placeId has invalid characters or length.").optional(),
    placeIds: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          return val.split(",").every((id) => placeIdRegex.test(id.trim()));
        },
        { message: "One or more placeIds are malformed or invalid." }
      ),
  }),
});

export const postCrowdReportSchema = z.object({
  body: z.object({
    placeId: z
      .string({ required_error: "placeId is required." })
      .trim()
      .min(1, "placeId is required.")
      .regex(placeIdRegex, "placeId has invalid characters or length."),
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
