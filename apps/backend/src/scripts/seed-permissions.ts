import "dotenv/config";
import mongoose from "mongoose";
import { AccountModel } from "../models/user.model.js";
import employeeModel from "../models/employee.model.js";
import permissionModel from "../models/permission.model.js";

const PERMISSION_SPECS = [
  { permissionName: "MANAGE_BOOKS", description: "Quản lý kho sách" },
  { permissionName: "MANAGE_LOANS", description: "Quản lý phiếu mượn" },
  { permissionName: "APPROVE_HANDOVER", description: "Duyệt bàn giao sách" },
  { permissionName: "PROCESS_RETURN", description: "Xử lý trả sách" },
  { permissionName: "COLLECT_PENALTY", description: "Thu và quản lý phiếu phạt" },
  { permissionName: "MANAGE_FACULTIES", description: "Quản lý khoa/viện" },
  { permissionName: "MANAGE_AUTHORS", description: "Quản lý tác giả" },
  { permissionName: "MANAGE_PUBLISHERS", description: "Quản lý nhà xuất bản" },
] as const;

async function seedPermissions(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Chưa cấu hình MONGODB_URI.");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const permissionIds: mongoose.Types.ObjectId[] = [];
  for (const spec of PERMISSION_SPECS) {
    const existing = await permissionModel.findOne({ permissionName: spec.permissionName }).select("_id");
    const permission = existing ?? (await permissionModel.create(spec));
    permissionIds.push(permission._id);
  }
  console.log(`Đã đồng bộ ${permissionIds.length} quyền chức năng.`);

  const employeeAccount = await AccountModel.findOne({
    ctuIdentifier: "CB99001",
    role: "EMPLOYEE",
    isActive: true,
  }).select("_id");

  if (employeeAccount) {
    await employeeModel.findByIdAndUpdate(
      employeeAccount._id,
      { $addToSet: { permissionIds: { $each: permissionIds } } },
      { upsert: true, new: true, runValidators: true },
    );
    console.log("Đã cấp đầy đủ quyền (bao gồm MANAGE_PUBLISHERS) cho nhân viên CB99001.");
  }
}

try {
  await seedPermissions();
} finally {
  await mongoose.disconnect();
}
