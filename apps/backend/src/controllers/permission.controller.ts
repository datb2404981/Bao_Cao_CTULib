import type { RequestHandler } from "express";
import {
  createPermission,
  getAllPermissions,
  getPermissionById,
  updatePermission,
} from "../services/permission.service.js";

export const createPermissionController: RequestHandler = async (req, res, next) => {
  try {
    const data = await createPermission(req.body);
    res.status(201).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const getAllPermissionsController: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getAllPermissions();
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const getPermissionController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getPermissionById(req.params.id);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const updatePermissionController: RequestHandler = async (req, res, next) => {
  try {
    const data = await updatePermission(req.params.id, req.body);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
