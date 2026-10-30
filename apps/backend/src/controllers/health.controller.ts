import type { RequestHandler } from "express";

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json({ status: "success", message: "API Service is healthy" });
};
