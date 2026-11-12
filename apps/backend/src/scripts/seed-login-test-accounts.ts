import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AccountModel } from "../models/user.model.js";
import employeeModel from "../models/employee.model.js";
import permissionModel from "../models/permission.model.js";
import { registerSchema } from "../schemas/auth.schema.js";

// Only the dedicated, fixed QA fixtures are eligible. Never update existing accounts.
const csv = readFileSync(new URL("../../../../docs/qa/apidog/login-fixed-accounts.csv", import.meta.url), "utf8");
const fixtures = csv.trim().split(/\r?\n/).slice(1).map((line) => {
  const [fixtureId, ctuIdentifier, email, password, role, active] = line.split(",");
  return { fixtureId, ...registerSchema.parse({ ctuIdentifier, email, password }), role, isActive: active === "true" };
});

const employeePermissionSpecs = [
  { permissionName: "MANAGE_BOOKS", description: "Quản lý kho sách" },
  { permissionName: "MANAGE_LOANS", description: "Quản lý phiếu mượn" },
  { permissionName: "APPROVE_HANDOVER", description: "Duyệt bàn giao sách" },
  { permissionName: "PROCESS_RETURN", description: "Xử lý trả sách" },
  { permissionName: "COLLECT_PENALTY", description: "Thu và quản lý phiếu phạt" },
  { permissionName: "MANAGE_FACULTIES", description: "Quản lý khoa/viện" },
  { permissionName: "MANAGE_AUTHORS", description: "Quản lý tác giả" },
] as const;

async function ensureEmployeeManagementAccess(): Promise<void> {
  const employeeFixture = fixtures.find((fixture) => fixture.role === "EMPLOYEE");
  if (!employeeFixture) throw new Error("Bộ fixture thiếu tài khoản Employee.");

  const account = await AccountModel.findOne({
    ctuIdentifier: employeeFixture.ctuIdentifier,
    role: "EMPLOYEE",
    isActive: true,
  }).select("_id");
  if (!account) throw new Error("Fixture Employee chưa sẵn sàng để cấp quyền quản lý.");

  const permissionIds = [];
  for (const spec of employeePermissionSpecs) {
    const existing = await permissionModel.findOne({ permissionName: spec.permissionName }).select("_id");
    const permission = existing ?? await permissionModel.create(spec);
    permissionIds.push(permission._id);
  }

  await employeeModel.findByIdAndUpdate(
    account._id,
    { $addToSet: { permissionIds: { $each: permissionIds } } },
    { upsert: true, new: true, runValidators: true },
  );
}

async function login(ctuIdentifier: string, password: string) {
  const response = await fetch("http://localhost:8080/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ctuIdentifier, password }),
    signal: AbortSignal.timeout(10000),
  });
  return { code: response.status, body: await response.json() };
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Không seed fixture trong production.");
  if (!process.env.MONGODB_URI) throw new Error("Thiếu cấu hình kết nối database.");
  const expected = ["B9900001", "CB99001", "ADMIN99001", "B9900002"];
  if (fixtures.length !== 4 || fixtures.some((f, i) => f.ctuIdentifier !== expected[i] ||
      !f.email.endsWith("@example.com") || !["READER", "EMPLOYEE", "ADMIN"].includes(f.role))) {
    throw new Error("Bộ fixture không đúng danh sách test cố định.");
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  // Match the previously verified reader through HTTP and DB before writing anything.
  const reader = fixtures[0]!;
  const readerLogin = await login(reader.ctuIdentifier, reader.password);
  const anchor = await AccountModel.findOne({ ctuIdentifier: reader.ctuIdentifier });
  if (readerLogin.code !== 200 || !anchor ||
      readerLogin.body.data?.user?.accountId !== anchor._id.toString()) {
    throw new Error("Database không khớp tài khoản test đã xác minh trên localhost:8080.");
  }
  if (await AccountModel.exists({ ctuIdentifier: "B9900099" })) {
    throw new Error("Mã dành cho case không tồn tại đã có dữ liệu; không sửa hoặc xóa tài khoản đó.");
  }

  const missing = [];
  for (const fixture of fixtures) {
    const existing = await AccountModel.findOne({ $or: [
      { ctuIdentifier: fixture.ctuIdentifier }, { email: fixture.email },
    ] }).select("+password");
    if (!existing) { missing.push(fixture); continue; }
    if (existing.ctuIdentifier !== fixture.ctuIdentifier || existing.email !== fixture.email ||
        existing.role !== fixture.role || existing.isActive !== fixture.isActive ||
        !(await bcrypt.compare(fixture.password, existing.password))) {
      throw new Error(`Fixture ${fixture.ctuIdentifier} xung đột dữ liệu; không ghi đè.`);
    }
  }
  for (const fixture of missing) {
    await AccountModel.create({
      ctuIdentifier: fixture.ctuIdentifier, email: fixture.email,
      password: await bcrypt.hash(fixture.password, 10),
      role: fixture.role, isActive: fixture.isActive,
    });
    console.log(`Đã tạo ${fixture.ctuIdentifier}: ${fixture.role}, isActive=${fixture.isActive}`);
  }

  await ensureEmployeeManagementAccess();
  console.log("Đã chuẩn bị hồ sơ Employee và quyền truy cập các màn hình quản lý.");

  for (const fixture of fixtures) {
    const result = await login(fixture.ctuIdentifier, fixture.password);
    const expectedCode = fixture.isActive ? 200 : 403;
    if (result.code !== expectedCode || (fixture.isActive
      ? result.body.data?.user?.ctuIdentifier !== fixture.ctuIdentifier || result.body.data?.user?.role !== fixture.role
      : result.body.message !== "Tài khoản đã bị khóa")) {
      throw new Error(`HTTP xác minh fixture ${fixture.ctuIdentifier} không đạt.`);
    }
    console.log(`Đã xác minh ${fixture.ctuIdentifier}: HTTP ${result.code}`);
  }
  for (const [identifier, password] of [
    [reader.ctuIdentifier, "WrongPassword123!"], ["B9900099", "QaAbsent123!"],
    ["B9900002", "WrongPassword123!"], [reader.ctuIdentifier, "qareader123!"],
  ]) {
    const result = await login(identifier!, password!);
    if (result.code !== 400 || result.body.message !== "Sai thông tin đăng nhập" || result.body.data !== null) {
      throw new Error("Case sai thông tin đăng nhập không đạt.");
    }
  }
  const lower = await login(reader.ctuIdentifier.toLowerCase(), reader.password);
  if (lower.code !== 200 || lower.body.data?.user?.ctuIdentifier !== reader.ctuIdentifier) {
    throw new Error("Case mã đăng nhập chữ thường không đạt.");
  }
  console.log("Hoàn tất: 4 fixture sẵn sàng, 9 trường hợp HTTP đạt kỳ vọng cơ bản. Không in token/cookie.");
}

try { await main(); }
catch (error) {
  // Do not expose driver errors, connection strings, credentials or HTTP response bodies.
  const message = error instanceof Error ? error.message : "";
  console.error(/^(Không seed|Thiếu cấu hình|Bộ fixture|Database không khớp|Mã dành|Fixture |HTTP xác minh|Case )/.test(message)
    ? message : "Chuẩn bị fixture thất bại; kiểm tra dịch vụ local và kết nối database.");
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
