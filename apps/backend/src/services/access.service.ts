import { AccountModel } from "../models/user.model.js";
import employeeModel from "../models/employee.model.js";
import permissionModel from "../models/permission.model.js";
import { AppError } from "../utils/app-error.js";

// Đọc lại tài khoản và quyền từ DB để việc khóa tài khoản/thu hồi quyền có hiệu lực ngay.
export const getAccountAccess = async (accountId: string) => {
  const account = await AccountModel.findById(accountId).select("ctuIdentifier email role isActive").lean();
  if (!account || !account.isActive) throw new AppError("Tài khoản không còn hoạt động", 401);
  const employee = account.role === "READER" ? null : await employeeModel.findById(accountId).lean();
  const permissions = employee?.permissionIds.length
    ? await permissionModel.find({ _id: { $in: employee.permissionIds } }).select("permissionName").lean()
    : [];
  return {
    accountId: account._id.toString(), ctuIdentifier: account.ctuIdentifier,
    email: account.email, role: account.role,
    permissions: [...new Set(permissions.map((permission) => permission.permissionName))],
  };
};
