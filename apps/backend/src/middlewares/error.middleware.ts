import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { AppError } from '../utils/app-error.js';

export const notFound: RequestHandler = (req, res, next) => {
  res.status(404).json({ status: "error", message: "Route not found" });
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error.message || "Internal server error";

  logger.error(`[${statusCode}] ${message}`);

  res.status(statusCode).json({
    success: "error",
    message: message,
    data: null,
  });
};