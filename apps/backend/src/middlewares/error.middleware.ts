import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { AppError } from '../utils/app-error.js';
import mongoose from "mongoose";

export const notFound: RequestHandler = (req, res, next) => {
  res.status(404).json({ status: "error", message: "Không tìm thấy đường dẫn yêu cầu.", data: null });
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    res.status(409).json({
      status: "error",
      message: "Dữ liệu đã tồn tại",
      data: null,
    });
    return;
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError
    ? error.message
    : "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.";

  logger.error(`[${statusCode}] ${error.message || message}`);

  res.status(statusCode).json({
    status: "error",
    message: message,
    data: null,
  });
};
