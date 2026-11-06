import { z } from "zod";

export const permissionSchema = z.object({
  permissionName: z.string().trim().min(1),
  description: z.string().trim().min(1),
}).strict();
export const updatePermissionSchema = permissionSchema.partial().refine((data) => Object.keys(data).length > 0, "Không có dữ liệu cập nhật");
export type PermissionInput = z.infer<typeof permissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
