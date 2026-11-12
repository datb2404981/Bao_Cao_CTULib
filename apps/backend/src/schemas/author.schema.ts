import z from "zod";

export const authorSchema = z.object({
  authorCode: z
    .string()
    .trim()
    .min(2, { message: "Mã tác giả phải có ít nhất 2 ký tự" })
    .max(30, { message: "Mã tác giả không được vượt quá 30 ký tự" })
    .optional(),
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
