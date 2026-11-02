import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AccountModel } from "../models/user.model.js";
import { registerSchema } from "../schemas/auth.schema.js";

async function seedAdmin(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Chưa cấu hình MONGODB_URI.");

  const input = registerSchema.parse({
    ctuIdentifier: process.env.SEED_ADMIN_IDENTIFIER ?? "ADMIN",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@ctulib.local",
    password: process.env.SEED_ADMIN_PASSWORD ?? randomBytes(18).toString("base64url"),
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const existing = await AccountModel.findOne({
    $or: [{ ctuIdentifier: input.ctuIdentifier }, { email: input.email }],
  }).select("_id");
  if (existing) {
    throw new Error("Mã đăng nhập hoặc email đã tồn tại; seed không ghi đè tài khoản.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const account = await AccountModel.create({
    ctuIdentifier: input.ctuIdentifier,
    email: input.email,
    password: passwordHash,
    role: "ADMIN",
    isActive: true,
  });

  const saved = await AccountModel.findById(account._id).select("+password");
  if (!saved || saved.role !== "ADMIN" || !saved.isActive ||
      !(await bcrypt.compare(input.password, saved.password))) {
    throw new Error("Không xác minh được tài khoản Admin vừa tạo.");
  }

  console.log("Đã tạo và xác minh tài khoản Admin.");
  console.log(`Mã đăng nhập: ${input.ctuIdentifier}`);
  console.log(`Email: ${input.email}`);
  console.log(`Mật khẩu khởi tạo: ${input.password}`);
}

try {
  await seedAdmin();
} catch (error) {
  // Không in lỗi kết nối/DB vì có thể chứa thông tin nhạy cảm.
  if (error instanceof Error && [
    "Chưa cấu hình MONGODB_URI.",
    "Mã đăng nhập hoặc email đã tồn tại; seed không ghi đè tài khoản.",
    "Không xác minh được tài khoản Admin vừa tạo.",
  ].includes(error.message)) {
    console.error(error.message);
  } else {
    console.error("Seed Admin thất bại. Kiểm tra kết nối DB và dữ liệu đầu vào (mật khẩu tối thiểu 8 ký tự).");
  }
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
