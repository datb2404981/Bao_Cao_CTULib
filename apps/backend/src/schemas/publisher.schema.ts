import { z } from "zod";

export const publisherSchema = z.object({
  publisherCode: z
    .string({ message: "Mã nhà xuất bản phải là chuỗi" })
    .trim()
    .min(2, { message: "Mã nhà xuất bản phải có ít nhất 2 ký tự" })
    .max(30, { message: "Mã nhà xuất bản không được vượt quá 30 ký tự" })
    .optional(),
  publisherName: z
    .string({ message: "Tên nhà xuất bản phải là chuỗi và không được bỏ trống" })
    .trim()
    .min(1, { message: "Tên nhà xuất bản không được để trống" })
    .max(100, { message: "Tên nhà xuất bản không được vượt quá 100 ký tự" }),
  address: z
    .string({ message: "Địa chỉ phải là chuỗi" })
    .trim()
    .max(255, { message: "Địa chỉ không được vượt quá 255 ký tự" })
    .optional(),
}).strict();

export type PublisherInput = z.infer<typeof publisherSchema>;
