import { isValidObjectId } from "mongoose";
import permissionModel from "../models/permission.model.js";
import type { PermissionInput, UpdatePermissionInput } from "../schemas/permission.schema.js";
import { AppError } from "../utils/app-error.js";

const validateId = (id: string) => { if (!isValidObjectId(id)) throw new AppError("Mã quyền không hợp lệ", 400); };
export const createPermission = async (data: PermissionInput) => permissionModel.create(data);
export const getAllPermissions = async () => permissionModel.find().lean();
export const getPermissionById = async (id: string) => {
  validateId(id);
  const permission = await permissionModel.findById(id).lean();
  if (!permission) throw new AppError("Quyền không tồn tại", 404);
  return permission;
};
export const updatePermission = async (id: string, data: UpdatePermissionInput) => {
  validateId(id);
  const permission = await permissionModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean();
  if (!permission) throw new AppError("Quyền không tồn tại", 404);
  return permission;
};
