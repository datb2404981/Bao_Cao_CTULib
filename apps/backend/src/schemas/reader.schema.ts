import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Mã không hợp lệ");
const readerFields = {
  fullName: z.string().trim().min(2).max(50).optional(),
  dateOfBirth: z.iso
    .date()
    .refine((date) => date < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }), "Ngày sinh phải trước ngày hiện tại")
    .optional(),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  readerType: z.enum(["STUDENT", "POSTGRADUATE", "STAFF"]).optional(),
  facultyId: objectId,
};
export const createReaderSchema = z
  .object({ accountId: objectId, ...readerFields })
  .strict();
export const updateReaderSchema = z
  .object(readerFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Không có dữ liệu cập nhật");
export type CreateReaderInput = z.infer<typeof createReaderSchema>;
export type UpdateReaderInput = z.infer<typeof updateReaderSchema>;
export const borrowingBlockSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().trim().max(500).default("")
}).strict().superRefine((data, ctx) => {
  if (data.blocked && data.reason.length < 5) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Lý do khóa phải có ít nhất 5 ký tự' });
});
export type BorrowingBlockInput = z.infer<typeof borrowingBlockSchema>;
