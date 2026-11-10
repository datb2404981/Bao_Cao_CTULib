import { z } from 'zod';

export const updateAccountSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ').max(254).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Cần nhập thông tin cập nhật');
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const accountListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(''),
  role: z.enum(['READER', 'EMPLOYEE', 'ADMIN']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
