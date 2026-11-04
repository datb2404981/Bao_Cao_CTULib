import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error.js";

export const authNoStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get("Origin");
  if (!origin && process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  const expected = process.env.CLIENT_URL;
  if (!expected || expected === "*") {
    next(new AppError("Dịch vụ xác thực tạm thời không khả dụng", 503));
    return;
  }
  if (origin !== expected) {
    next(new AppError("Origin không được phép", 403));
    return;
  }
  next();
};

export const validateSessionRequest: RequestHandler = (req, _res, next) => {
  const body = req.body;
  const validBody = body === undefined || (
    body !== null && typeof body === "object" &&
    !Array.isArray(body) && Object.keys(body).length === 0
  );
  if (!validBody || Object.keys(req.query).length > 0 || req.get("Authorization") !== undefined) {
    next(new AppError("Dữ liệu gửi lên không hợp lệ", 400));
    return;
  }
  next();
};
