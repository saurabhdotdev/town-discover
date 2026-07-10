import { z } from "zod/v3";

const placeIdRegex = /^[a-zA-Z0-9:_-]{1,120}$/;

export const postLaunchDealSchema = z.object({
  body: z.object({
    placeId: z
      .string({ required_error: "placeId is required." })
      .trim()
      .min(1, "placeId is required.")
      .regex(placeIdRegex, "placeId has invalid characters or length."),
    placeTitle: z.string({ required_error: "placeTitle is required." }).trim().min(2, "placeTitle is required.").max(100, "placeTitle must be at most 100 characters."),
    discountPercentage: z
      .number({ required_error: "discountPercentage is required." })
      .int("discountPercentage must be an integer.")
      .min(5, "discountPercentage must be at least 5%.")
      .max(95, "discountPercentage cannot exceed 95%."),
    description: z
      .string()
      .trim()
      .max(180, "Description must be at most 180 characters.")
      .optional()
      .nullable()
      .transform((val) => val || ""),
  }),
});

export type PostLaunchDealInput = z.infer<typeof postLaunchDealSchema>;
