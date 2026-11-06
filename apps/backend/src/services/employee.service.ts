import { Types } from "mongoose";
import employeeModel from "../models/employee.model.js";
import permissionModel from "../models/permission.model.js";
import { AccountModel } from "../models/user.model.js";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "../schemas/employee.schema.js";
import { AppError } from "../utils/app-error.js";

const validateId = (id: string) => { if (!/^[a-fA-F0-9]{24}$/.test(id)) throw new AppError("Mã nhân viên không hợp lệ", 400); };
const checkPermissions = async (ids?: string[]) => {
  if (ids && await permissionModel.countDocuments({ _id: { $in: ids } }) !== ids.length) throw new AppError("Quyền không tồn tại", 404);
};
export const createEmployee = async (input: CreateEmployeeInput) => {
  const account = await AccountModel.findById(input.accountId).lean();
  if (!account) throw new AppError("Tài khoản không tồn tại", 404);
  if (account.role !== "EMPLOYEE" && account.role !== "ADMIN") throw new AppError("Tài khoản không phải nhân viên", 400);
  await checkPermissions(input.permissionIds);
  if (await employeeModel.exists({ _id: input.accountId })) throw new AppError("Hồ sơ nhân viên đã tồn tại", 409);
  const { accountId, permissionIds, ...data } = input;
  try { return await employeeModel.create({ ...data, _id: new Types.ObjectId(accountId), permissionIds: permissionIds?.map((id) => new Types.ObjectId(id)) }); }
  catch (error) { if (error instanceof Error && "code" in error && error.code === 11000) throw new AppError("Hồ sơ nhân viên đã tồn tại", 409); throw error; }
};
export const getAllEmployees = async () => employeeModel.find().lean();
export const getEmployeeById = async (id: string) => {
  validateId(id);
  const employee = await employeeModel.findById(id).lean();
  if (!employee) throw new AppError("Nhân viên không tồn tại", 404);
  return employee;
};
export const updateEmployee = async (id: string, data: UpdateEmployeeInput) => {
  validateId(id);
  await checkPermissions(data.permissionIds);
  const employee = await employeeModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean();
  if (!employee) throw new AppError("Nhân viên không tồn tại", 404);
  return employee;
};
