import type { RequestHandler } from "express";
import { getDashboardStatistics } from "../services/dashboard.service.js";

export const getDashboardStatsController: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getDashboardStatistics();
    res.json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
