import z from "zod";

export const authorSchema = z.object({
  fullName: z
    .string()
    .min(1, { message: "Full name is required" })
    .max(50, { message: "Full name must be les than 50 characters" }),
  affiliation: z
    .string()
    .max(255, { message: "Affiliation must be less than 255 characters" })
    .optional(),
  notes: z
    .string()
    .optional()
})