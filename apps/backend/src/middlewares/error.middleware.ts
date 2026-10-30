import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../config/logger.js";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  logger.error(error instanceof Error ? error.message : "Unexpected error");
  res.status(500).json({ status: "error", message: "Internal server error" });
};
