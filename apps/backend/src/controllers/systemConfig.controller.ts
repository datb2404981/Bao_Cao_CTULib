import type { RequestHandler } from "express";
import {
  createSystemConfig,
  getAllSystemConfigs,
  updateSystemConfig,
} from "../services/systemConfig.service.js";

export const getAllSystemConfigsController: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getAllSystemConfigs();
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createSystemConfigHandlerController: RequestHandler = async (req, res, next) => {
  try {
    const { key, value, description } = req.body;
    const newConfig = await createSystemConfig({ key, value, description });
    return res.status(201).json({
      status: "success",
      data: newConfig,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSystemConfigHandlerController: RequestHandler = async (req, res, next) => {
  try {
    const key = (req.params.key || req.body.key) as string;
    const { value } = req.body;
    const updateConfig = await updateSystemConfig({ key, value });
    return res.status(200).json({
      status: "success",
      data: updateConfig,
    });
  } catch (error) {
    next(error);
  }
};
