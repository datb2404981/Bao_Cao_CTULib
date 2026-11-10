import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import mongoose, { Types } from "mongoose";
import { AccountModel } from "../src/models/user.model.js";
import bookModel from "../src/models/book.model.js";
import employeeModel from "../src/models/employee.model.js";
import loanRecordModel from "../src/models/loanRecord.model.js";
import penaltyRecordModel from "../src/models/penaltyRecord.model.js";
import permissionModel from "../src/models/permission.model.js";
import readerModel from "../src/models/reader.model.js";
import { generateAccessToken } from "../src/utils/jwt.util.js";

// Bộ dữ liệu hoàn toàn tách biệt. Từ chối URI có thể trỏ tới DB phát triển/production.
const uri = process.env.CTULIB_TEST_MONGODB_URI;
if (!uri) throw new Error("Thiếu CTULIB_TEST_MONGODB_URI.");
const parsed = new URL(uri);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname) ||
    !/^\/ctulib_qa_dashboard_[a-zA-Z0-9_]+$/.test(parsed.pathname) ||
    !parsed.searchParams.has("replicaSet")) {
  throw new Error("Chỉ cho phép Mongo replica set loopback trên DB ctulib_qa_dashboard_*.");
}

const suiteId = process.env.APIDOG_DASHBOARD_SUITE_ID;
if (!suiteId || !/^\d+$/.test(suiteId)) throw new Error("Thiếu APIDOG_DASHBOARD_SUITE_ID hợp lệ.");

process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.ACCESS_TOKEN_SECRET_KEY = randomBytes(32).toString("hex");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const seed = async () => {
  const permission = await permissionModel.create({ permissionName: "MANAGE_LOANS", description: "Dashboard QA" });
  const readerIds = [new Types.ObjectId(), new Types.ObjectId()];
  const staffId = new Types.ObjectId();
  const noPermissionStaffId = new Types.ObjectId();

  const accounts = [
    ...readerIds.map(id => ({ _id: id, ctuIdentifier: `QA-${id}`, email: `${id}@qa.invalid`, password: "qa-only", role: "READER" as const })),
    { _id: staffId, ctuIdentifier: `QA-${staffId}`, email: `${staffId}@qa.invalid`, password: "qa-only", role: "EMPLOYEE" as const },
    { _id: noPermissionStaffId, ctuIdentifier: `QA-${noPermissionStaffId}`, email: `${noPermissionStaffId}@qa.invalid`, password: "qa-only", role: "EMPLOYEE" as const },
  ];
  await AccountModel.insertMany(accounts);
  await readerModel.insertMany(readerIds.map(_id => ({ _id, facultyId: new Types.ObjectId() })));
  await employeeModel.insertMany([
    { _id: staffId, permissionIds: [permission._id] },
    { _id: noPermissionStaffId, permissionIds: [] },
  ]);

  const books = await bookModel.insertMany([
    { title: "QA Dashboard - còn sách", bookType: "TEXTBOOK", facultyId: new Types.ObjectId(), authorIds: [], coverPrice: 100000, totalCopies: 3, availableCopies: 2, isAvailableForCirculation: true },
    { title: "QA Dashboard - hết sách", bookType: "REFERENCE", facultyId: new Types.ObjectId(), authorIds: [], coverPrice: 80000, totalCopies: 1, availableCopies: 0, isAvailableForCirculation: true },
    { title: "QA Dashboard - còn một bản", bookType: "TEXTBOOK", facultyId: new Types.ObjectId(), authorIds: [], coverPrice: 120000, totalCopies: 2, availableCopies: 1, isAvailableForCirculation: true },
    { title: "QA Dashboard - ngừng lưu hành", bookType: "TEXTBOOK", facultyId: new Types.ObjectId(), authorIds: [], coverPrice: 120000, totalCopies: 5, availableCopies: 0, isAvailableForCirculation: false },
  ]);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const reservationDate = new Date(now - 12 * day);
  const reservationExpiryDate = new Date(now + 2 * day);
  const loans = await loanRecordModel.insertMany([
    { readerId: readerIds[0], bookId: books[0]._id, reservationDate, reservationExpiryDate, handoverDate: new Date(now - day), dueDate: new Date(now + 7 * day), status: "Đang mượn" },
    { readerId: readerIds[1], bookId: books[1]._id, reservationDate, reservationExpiryDate, handoverDate: new Date(now - 10 * day), dueDate: new Date(now - day), status: "Đang mượn" },
    { readerId: readerIds[0], bookId: books[2]._id, reservationDate, reservationExpiryDate, handoverDate: new Date(now - 10 * day), dueDate: new Date(now - 5 * day), actualReturnDate: new Date(now - day), status: "Chờ nộp phạt" },
    { readerId: readerIds[1], bookId: books[0]._id, reservationDate, reservationExpiryDate, handoverDate: new Date(now - 10 * day), dueDate: new Date(now - 5 * day), actualReturnDate: new Date(now - 2 * day), status: "Đã trả" },
  ]);
  await penaltyRecordModel.insertMany([
    { loanRecordId: loans[2]._id, appliedCoverPrice: 120000, totalPenalty: 15000, paymentStatus: "Chờ thanh toán" },
    { loanRecordId: loans[3]._id, appliedCoverPrice: 100000, totalPenalty: 25000, paymentStatus: "Đã thanh toán", paymentDate: new Date(now - day) },
  ]);
  return {
    staff: generateAccessToken({ accountId: staffId.toHexString(), ctuIdentifier: `QA-${staffId}`, role: "EMPLOYEE" }),
    reader: generateAccessToken({ accountId: readerIds[0].toHexString(), ctuIdentifier: `QA-${readerIds[0]}`, role: "READER" }),
    noPermissionStaff: generateAccessToken({ accountId: noPermissionStaffId.toHexString(), ctuIdentifier: `QA-${noPermissionStaffId}`, role: "EMPLOYEE" }),
  };
};

const main = async () => {
  let server: Server | undefined;
  let ownsDatabase = false;
  let tempDataDir: string | undefined;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const existing = await mongoose.connection.db!.listCollections().toArray();
    if (existing.length > 0) throw new Error("Database QA đã có collections; cần một tên DB mới để tránh xóa dữ liệu.");
    ownsDatabase = true;
    const tokens = await seed();
    const { app } = await import("../src/app.js");
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(8080, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    // Xác nhận fixture + JWT nội bộ trước khi chạy bộ kiểm thử qua Apidog CLI.
    for (const [name, token, expected] of [
      ["staff", tokens.staff, 200],
      ["reader", tokens.reader, 403],
      ["staff-no-permission", tokens.noPermissionStaff, 403],
    ] as const) {
      const response = await fetch("http://127.0.0.1:8080/api/v1/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status !== expected) {
        const body = await response.json() as { message?: string };
        throw new Error(`Dashboard smoke ${name}: HTTP ${response.status}, expected ${expected}: ${body.message ?? ""}`);
      }
    }
    console.log("Dashboard QA smoke: staff=200, reader=403, staff-no-permission=403.");
    console.log("Dashboard QA: seeded 3 active books, 2 readers, 4 loans, 2 penalties.");
    // Apidog resolve biến {{...}} trong request từ iteration data ngay cả khi
    // test suite không khai báo sẵn biến trong environment. File chỉ tồn tại trong lúc chạy.
    tempDataDir = await mkdtemp(path.join(os.tmpdir(), "ctulib-dashboard-qa-"));
    const rows = JSON.parse(await readFile(path.join(repoRoot, "docs/dashboard-qa/iterations.json"), "utf8")) as Record<string, number>[];
    const iterationFile = path.join(tempDataDir, "iterations.json");
    await writeFile(iterationFile, JSON.stringify(rows.map(row => ({
      ...row,
      dashboardStaffToken: tokens.staff,
      dashboardReaderToken: tokens.reader,
      dashboardNoPermissionToken: tokens.noPermissionStaff,
    }))), { mode: 0o600 });
    const cliArgs = [
      "run", "--project", "1405851", "--test-suite", suiteId!, "-e", "6970109",
      "-d", iterationFile,
      "-r", "cli,junit", "--on-error", "end",
      "--out-dir", path.join(repoRoot, "apidog-reports/dashboard"),
    ];
    // CI cần access token; khi chạy local, Apidog CLI dùng phiên đăng nhập hiện tại.
    if (process.env.APIDOG_TOKEN) cliArgs.push("--access-token", process.env.APIDOG_TOKEN);
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("apidog", cliArgs, { cwd: repoRoot, stdio: "inherit" });
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 1)));
    });
    if (exitCode !== 0) throw new Error(`Apidog dashboard suite thất bại (exit code ${exitCode}).`);
    console.log("Dashboard Apidog QA: PASS.");
  } finally {
    if (tempDataDir) await rm(tempDataDir, { recursive: true, force: true });
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    if (mongoose.connection.readyState === 1) {
      if (ownsDatabase) await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
};

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
