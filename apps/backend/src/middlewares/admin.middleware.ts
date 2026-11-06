import type { RequestHandler } from "express";
import { AccountModel } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

export const requireAdmin: RequestHandler = async (req: AuthenticatedRequest, _res, next) => {
  try {
    const account = await AccountModel.findById(req.user?.accountId).select("role isActive").lean();
    if (!account || !account.isActive || account.role !== "ADMIN") {
      throw new AppError("Không đủ quyền truy cập", 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};
