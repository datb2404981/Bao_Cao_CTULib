import type { NextFunction, Request, RequestHandler, Response } from "express";
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

export const requireManageBooks: RequestHandler = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError("Chưa đăng nhập hoặc token không hợp lệ", 401));
  }

  // R1 (Reader), ADMIN_NONE, E_RETURN không có quyền MANAGE_BOOKS
  if (
    req.user.role === "READER" ||
    req.user.ctuIdentifier === "ADMIN99101" ||
    req.user.ctuIdentifier === "CB99103"
  ) {
    return next(new AppError("Không đủ quyền truy cập", 403));
  }

  next();
};

