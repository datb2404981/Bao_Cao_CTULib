import { z } from "zod";

export const facultySchema = z.object({
  facultyCode: z
    .string({ message: "Mã khoa phải là chuỗi" })
    .trim()
    .min(2, { error: "Mã khoa phải có ít nhất 2 ký tự" })
    .max(30, { error: "Mã khoa không được vượt quá 30 ký tự" })
    .optional(),
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

