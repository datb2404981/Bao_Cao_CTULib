import { z } from "zod";

export const facultySchema = z.object({
  facultyName: z
    .string({ message: "Tên khoa phải là chuỗi và không được bỏ trống" })
    .trim()
    .min(1, { error: "Tên khoa không được để trống" })
    .max(100, {error:"Tên khoa khong được vượt quá 100 ký tự"}),
  description: z
    .string({ error: "Mô tả phải là chuỗi" })
    .trim()
    .max(1000, {error:"Mô tả không được vượt quá 1000 ký tự"})
    .optional()
}).strict();

