import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import { getAccountAccess } from "../services/access.service.js";
import { AppError } from "../utils/app-error.js";

export const requirePermission = (permission: string): RequestHandler => async (req: AuthenticatedRequest, _res, next) => {
  try {
    if (!req.user) throw new AppError("Chưa đăng nhập", 401);
    const account = await getAccountAccess(req.user.accountId);
    if (!["ADMIN", "EMPLOYEE"].includes(account.role) || !account.permissions.includes(permission)) {
      throw new AppError("Không đủ quyền truy cập", 403);
    }
    next();
  } catch (error) { next(error); }
};
