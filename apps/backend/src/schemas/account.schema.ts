import { z } from 'zod';

export const updateAccountSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(254).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Cần nhập thông tin cập nhật');
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const createStaffAccountSchema = z.object({
  ctuIdentifier: z.string().trim().min(3, 'Mã cán bộ / nhân viên tối thiểu 3 ký tự').max(32),
  email: z.string().trim().email('Email không hợp lệ').max(254),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
  role: z.enum(['EMPLOYEE', 'ADMIN']).default('EMPLOYEE'),
  fullName: z.string().trim().min(1, 'Họ tên không được để trống').max(100),
  position: z.string().trim().max(100).optional().default(''),
  phoneNumber: z.string().trim().max(20).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
  permissionIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Mã quyền không hợp lệ')).optional().default([]),
}).strict();
export type CreateStaffAccountInput = z.infer<typeof createStaffAccountSchema>;

export const accountListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(''),
  role: z.enum(['READER', 'EMPLOYEE', 'ADMIN', 'STAFF']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
