import type { NextFunction, Request, RequestHandler, Response } from "express";
import { requirePermission } from "./permission.middleware.js";
import { AppError } from "../utils/app-error.js";
import { TokenPayload, verifyToken } from "../utils/jwt.util.js";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticate: RequestHandler = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Chưa đăng nhập hoặc token không hợp lệ", 401));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(new AppError("Chưa đăng nhập hoặc token không hợp lệ", 401));
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireManageBooks = requirePermission("MANAGE_BOOKS");
