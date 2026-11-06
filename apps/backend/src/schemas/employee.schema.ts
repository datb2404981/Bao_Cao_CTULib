import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Mã không hợp lệ");
const employeeFields = {
  fullName: z.string().trim().min(2).max(50).optional(),
  position: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  permissionIds: z.array(objectId).refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, "Quyền không được trùng lặp").optional(),
};
export const createEmployeeSchema = z.object({ accountId: objectId, ...employeeFields }).strict();
export const updateEmployeeSchema = z.object(employeeFields).partial().strict().refine((data) => Object.keys(data).length > 0, "Không có dữ liệu cập nhật");
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
