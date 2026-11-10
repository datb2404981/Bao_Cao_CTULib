import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { AccountModel } from "../src/models/user.model.js";
import bookModel from "../src/models/book.model.js";
import employeeModel from "../src/models/employee.model.js";
import loanRecordModel from "../src/models/loanRecord.model.js";
import penaltyRecordModel from "../src/models/penaltyRecord.model.js";
import permissionModel from "../src/models/permission.model.js";
import readerModel from "../src/models/reader.model.js";
import { generateAccessToken } from "../src/utils/jwt.util.js";

const uri = process.env.CTULIB_TEST_MONGODB_URI;
if (!uri) throw new Error("Cần CTULIB_TEST_MONGODB_URI để kiểm thử API.");
const parsed = new URL(uri);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    !parsed.pathname.startsWith("/ctulib_qa_") ||
    !parsed.searchParams.has("replicaSet")) {
  throw new Error("API test chỉ cho phép replica set loopback, database ctulib_qa_*.");
}

// App có import dotenv/config. Chặn đọc cấu hình thật và dùng khóa ký tạm chỉ trong process QA.
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.ACCESS_TOKEN_SECRET_KEY = randomBytes(32).toString("hex");

let server: Server;
let baseUrl: string;
const readerId = new Types.ObjectId();
const employeeId = new Types.ObjectId();
const permissionId = new Types.ObjectId();
const collectPermissionId = new Types.ObjectId();
const handoverPermissionId = new Types.ObjectId();
const returnPermissionId = new Types.ObjectId();
const staffWithoutCollectId = new Types.ObjectId();
const otherReaderId = new Types.ObjectId();
const bookIds = Array.from({ length: 6 }, () => new Types.ObjectId());
const additionalReaderIds: Types.ObjectId[] = [];
const additionalEmployeeIds: Types.ObjectId[] = [];
let readerToken: string;
let staffToken: string;
let staffWithoutCollectToken: string;
let otherReaderToken: string;

type ApiResult = {
  status: string;
  data: unknown;
  message?: string;
};

const callApi = async (path: string, token?: string, method = "GET", body?: unknown) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { code: response.status, body: await response.json() as ApiResult };
};

const asRecord = (value: unknown): Record<string, unknown> => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
};

before(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await permissionModel.insertMany([
      { _id: permissionId, permissionName: "MANAGE_LOANS", description: "Quản lý phiếu mượn trong QA" },
      { _id: collectPermissionId, permissionName: "COLLECT_PENALTY", description: "Thu tiền phạt trong QA" },
      { _id: handoverPermissionId, permissionName: "APPROVE_HANDOVER", description: "Bàn giao sách trong QA" },
      { _id: returnPermissionId, permissionName: "PROCESS_RETURN", description: "Nhận trả sách trong QA" },
    ]);
    await AccountModel.insertMany([
      {
        _id: readerId,
        ctuIdentifier: `QA-R-${readerId}`,
        email: `reader-${readerId}@qa.invalid`,
        password: "test-only",
        role: "READER",
      },
      {
        _id: employeeId,
        ctuIdentifier: `QA-E-${employeeId}`,
        email: `staff-${employeeId}@qa.invalid`,
        password: "test-only",
        role: "EMPLOYEE",
      },
      {
        _id: staffWithoutCollectId,
        ctuIdentifier: `QA-E-${staffWithoutCollectId}`,
        email: `staff-${staffWithoutCollectId}@qa.invalid`,
        password: "test-only",
        role: "EMPLOYEE",
      },
      {
        _id: otherReaderId,
        ctuIdentifier: `QA-R-${otherReaderId}`,
        email: `reader-${otherReaderId}@qa.invalid`,
        password: "test-only",
        role: "READER",
      },
    ]);
    await readerModel.create({ _id: readerId, facultyId: new Types.ObjectId() });
    await readerModel.create({ _id: otherReaderId, facultyId: new Types.ObjectId() });
    await employeeModel.create({ _id: employeeId, permissionIds: [permissionId, collectPermissionId, handoverPermissionId, returnPermissionId] });
    await employeeModel.create({ _id: staffWithoutCollectId, permissionIds: [permissionId] });
    await bookModel.insertMany(bookIds.map((_id, i) => ({
      _id,
      title: `Sách kiểm thử API ${i}`,
      facultyId: new Types.ObjectId(),
      authorIds: [],
      bookType: "TEXTBOOK",
      coverPrice: 100000,
      totalCopies: 1,
      availableCopies: 1,
      isAvailableForCirculation: true,
    })));
    readerToken = generateAccessToken({ accountId: readerId.toHexString(), ctuIdentifier: `QA-R-${readerId}`, role: "READER" });
    staffToken = generateAccessToken({ accountId: employeeId.toHexString(), ctuIdentifier: `QA-E-${employeeId}`, role: "EMPLOYEE" });
    staffWithoutCollectToken = generateAccessToken({ accountId: staffWithoutCollectId.toHexString(), ctuIdentifier: `QA-E-${staffWithoutCollectId}`, role: "EMPLOYEE" });
    otherReaderToken = generateAccessToken({ accountId: otherReaderId.toHexString(), ctuIdentifier: `QA-R-${otherReaderId}`, role: "READER" });

    const { app } = await import("../src/app.js");
    server = await new Promise<Server>(resolve => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Không tìm được cổng QA server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }
});

after(async () => {
  try {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (mongoose.connection.readyState !== 1) return;
    const allReaderIds = [readerId, otherReaderId, ...additionalReaderIds];
    const loans = await loanRecordModel.find({ readerId: { $in: allReaderIds } })
      .select("_id").lean();
    await penaltyRecordModel.deleteMany({ loanRecordId: { $in: loans.map(loan => loan._id) } });
    await loanRecordModel.deleteMany({ readerId: { $in: allReaderIds } });
    await bookModel.deleteMany({ _id: { $in: bookIds } });
    await readerModel.deleteMany({ _id: { $in: allReaderIds } });
    await employeeModel.deleteMany({ _id: { $in: [employeeId, staffWithoutCollectId, ...additionalEmployeeIds] } });
    await AccountModel.deleteMany({ _id: { $in: [...allReaderIds, employeeId, staffWithoutCollectId, ...additionalEmployeeIds] } });
    await permissionModel.deleteMany({ _id: { $in: [permissionId, collectPermissionId, handoverPermissionId, returnPermissionId] } });
  } finally {
    await mongoose.disconnect();
  }
});

const prepareBorrowed = async (bookId: Types.ObjectId, overdue = false) => {
  const booked = await callApi("/api/v1/loans", readerToken, "POST", { bookId: bookId.toHexString() });
  assert.equal(booked.code, 201, JSON.stringify(booked.body));
  const loanId = String(asRecord(booked.body.data).loanId);
  const handover = await callApi(`/api/v1/loans/${loanId}/handover`, staffToken, "PATCH");
  assert.equal(handover.code, 200, JSON.stringify(handover.body));
  if (overdue) {
    await loanRecordModel.updateOne({ _id: loanId }, { $set: { dueDate: new Date(Date.now() - 86400000) } });
  }
  return loanId;
};

const createQaReader = async () => {
  const id = new Types.ObjectId();
  const ctuIdentifier = `QA-R-${id}`;
  await AccountModel.create({
    _id: id, ctuIdentifier, email: `reader-${id}@qa.invalid`,
    password: "test-only", role: "READER",
  });
  additionalReaderIds.push(id);
  await readerModel.create({ _id: id, facultyId: new Types.ObjectId() });
  return { id, token: generateAccessToken({ accountId: id.toHexString(), ctuIdentifier, role: "READER" }) };
};

const createQaEmployeeWithoutLoanPermission = async () => {
  const id = new Types.ObjectId();
  const ctuIdentifier = `QA-E-${id}`;
  await AccountModel.create({
    _id: id, ctuIdentifier, email: `staff-${id}@qa.invalid`,
    password: "test-only", role: "EMPLOYEE",
  });
  additionalEmployeeIds.push(id);
  await employeeModel.create({ _id: id, permissionIds: [collectPermissionId] });
  return generateAccessToken({ accountId: id.toHexString(), ctuIdentifier, role: "EMPLOYEE" });
};

const createQaBook = async (label: string, copies = 1) => {
  const id = new Types.ObjectId();
  bookIds.push(id);
  await bookModel.create({
    _id: id, title: `QA HTTP ${label}`, facultyId: new Types.ObjectId(),
    authorIds: [], bookType: "TEXTBOOK", coverPrice: 100000,
    totalCopies: copies, availableCopies: copies, isAvailableForCirculation: true,
  });
  return id;
};

const reserveViaHttp = async (bookId: Types.ObjectId, token: string) =>
  callApi("/api/v1/loans", token, "POST", { bookId: bookId.toHexString() });

const getLoanId = (result: { code: number; body: ApiResult }) => {
  assert.equal(result.code, 201, JSON.stringify(result.body));
  return String(asRecord(result.body.data).loanId);
};

test("Apidog contract: đọc chi tiết phiếu theo chủ sở hữu và phân quyền thu phạt", async () => {
  const loanId = await prepareBorrowed(bookIds[2]);
  const mine = await callApi(`/api/v1/loans/${loanId}`, readerToken);
  assert.equal(mine.code, 200, JSON.stringify(mine.body));
  assert.equal(asRecord(mine.body.data).loanId, loanId);
  assert.equal(asRecord(mine.body.data).status, "BORROWED");
  assert.equal(asRecord(mine.body.data).penalty, null);
  assert.equal((await callApi(`/api/v1/loans/${loanId}`, otherReaderToken)).code, 403);
  assert.equal((await callApi(`/api/v1/loans/${loanId}`, staffWithoutCollectToken)).code, 200);
  assert.equal((await callApi("/api/v1/penalties", readerToken)).code, 403);
  assert.equal((await callApi("/api/v1/penalties", staffWithoutCollectToken)).code, 403);
  assert.equal((await callApi("/api/v1/penalties?page=0", staffToken)).code, 400);
  assert.equal((await callApi(`/api/v1/penalties/${new Types.ObjectId()}`, staffToken)).code, 404);
  assert.equal((await callApi("/api/v1/penalties/invalid", staffToken)).code, 400);

  const invalidDamaged = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", {
    condition: "DAMAGED", damageRatio: 25, violationNote: "   ",
  });
  assert.equal(invalidDamaged.code, 400);
  const returned = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", {
    condition: "DAMAGED", damageRatio: 25, violationNote: "Rách bìa sách",
  });
  assert.equal(returned.code, 200, JSON.stringify(returned.body));
  assert.equal(asRecord(returned.body.data).returnCondition, "DAMAGED");
  assert.equal(asRecord(returned.body.data).damageRatio, 25);
  assert.equal(asRecord(returned.body.data).status, "FINE_PENDING");
  const summary = asRecord(asRecord(returned.body.data).penalty);
  const penaltyId = String(summary.penaltyId);
  assert.equal(summary.totalPenalty, 25000);
  assert.equal((await bookModel.findById(bookIds[2]).lean())?.availableCopies, 0);

  const penaltyView = await callApi(`/api/v1/penalties/${penaltyId}`, staffToken);
  assert.equal(penaltyView.code, 200, JSON.stringify(penaltyView.body));
  assert.equal(asRecord(penaltyView.body.data).violationNote, "Rách bìa sách");
  const listing = await callApi(`/api/v1/penalties?paymentStatus=PENDING&loanId=${loanId}&readerAccountId=${readerId}`, staffToken);
  assert.equal(listing.code, 200, JSON.stringify(listing.body));
  const items = asRecord(listing.body.data).items;
  assert.ok(Array.isArray(items));
  assert.equal(items.length, 1);
  assert.equal(asRecord(items[0]).penaltyId, penaltyId);

  assert.equal((await callApi(`/api/v1/penalties/${penaltyId}/collect`, staffWithoutCollectToken, "PATCH", {
    confirmFullCashReceived: true, expectedTotalPenalty: 25000,
  })).code, 403);
  assert.equal((await callApi(`/api/v1/penalties/${penaltyId}/collect`, staffToken, "PATCH", {
    confirmFullCashReceived: false, expectedTotalPenalty: 25000,
  })).code, 400);
  assert.equal((await callApi(`/api/v1/penalties/${penaltyId}/collect`, staffToken, "PATCH", {
    confirmFullCashReceived: true, expectedTotalPenalty: 20000,
  })).code, 409);
  const paid = await callApi(`/api/v1/penalties/${penaltyId}/collect`, staffToken, "PATCH", {
    confirmFullCashReceived: true, expectedTotalPenalty: 25000,
  });
  assert.equal(paid.code, 200, JSON.stringify(paid.body));
  const paidData = asRecord(paid.body.data);
  assert.equal(asRecord(paidData.loan).status, "RETURNED");
  assert.equal(asRecord(paidData.penalty).paymentStatus, "PAID");
  assert.equal(asRecord(paidData.penalty).amountCollected, 25000);
  assert.equal(asRecord(paidData.penalty).paymentMethod, "CASH");
  assert.equal((await bookModel.findById(bookIds[2]).lean())?.availableCopies, 0);
  assert.equal((await callApi(`/api/v1/penalties/${penaltyId}/collect`, staffToken, "PATCH", {
    confirmFullCashReceived: true, expectedTotalPenalty: 25000,
  })).code, 409);
  assert.equal((await callApi(`/api/v1/penalties?paymentStatus=PENDING&loanId=${loanId}`, staffToken)).body.status, "success");
});

test("Apidog contract: nguyên vẹn quá hạn, khóa thủ công và mất sách", async () => {
  const overdueId = await prepareBorrowed(bookIds[3], true);
  const returned = await callApi(`/api/v1/loans/${overdueId}/return`, staffToken, "PATCH", { condition: "GOOD" });
  assert.equal(returned.code, 200, JSON.stringify(returned.body));
  const overduePenalty = asRecord(asRecord(returned.body.data).penalty);
  assert.ok(Number(overduePenalty.totalPenalty) > 0);
  assert.equal((await bookModel.findById(bookIds[3]).lean())?.availableCopies, 0);
  await readerModel.updateOne({ _id: readerId }, { $set: { isBorrowingManuallyBlocked: true } });
  const paid = await callApi(`/api/v1/penalties/${overduePenalty.penaltyId}/collect`, staffToken, "PATCH", {
    confirmFullCashReceived: true, expectedTotalPenalty: overduePenalty.totalPenalty,
  });
  assert.equal(paid.code, 200, JSON.stringify(paid.body));
  assert.equal(asRecord(paid.body.data).isBorrowingBlocked, true);
  assert.equal((await bookModel.findById(bookIds[3]).lean())?.availableCopies, 1);
  await readerModel.updateOne({ _id: readerId }, { $set: { isBorrowingManuallyBlocked: false, isBorrowingBlocked: false } });

  const lostId = await prepareBorrowed(bookIds[4]);
  const lost = await callApi(`/api/v1/loans/${lostId}/return`, staffToken, "PATCH", {
    condition: "LOST", violationNote: "Không tìm thấy sách",
  });
  assert.equal(lost.code, 200, JSON.stringify(lost.body));
  assert.equal(asRecord(lost.body.data).returnCondition, "LOST");
  assert.equal(asRecord(lost.body.data).damageRatio, 100);
  const penalty = asRecord(asRecord(lost.body.data).penalty);
  const settled = await callApi(`/api/v1/penalties/${penalty.penaltyId}/collect`, staffToken, "PATCH", {
    confirmFullCashReceived: true, expectedTotalPenalty: penalty.totalPenalty,
  });
  assert.equal(settled.code, 200, JSON.stringify(settled.body));
  assert.equal((await bookModel.findById(bookIds[4]).lean())?.totalCopies, 0);
  assert.equal((await bookModel.findById(bookIds[4]).lean())?.availableCopies, 0);
});

test("HTTP contract: xác thực, phân quyền và kiểm tra đầu vào", async () => {
  const unauthenticated = await callApi("/api/v1/loans/me");
  assert.equal(unauthenticated.code, 401);
  assert.equal(unauthenticated.body.status, "error");

  const staffCannotReserve = await callApi("/api/v1/loans", staffToken, "POST", { bookId: bookIds[0].toHexString() });
  assert.equal(staffCannotReserve.code, 403);

  const readerCannotHandover = await callApi(`/api/v1/loans/${new Types.ObjectId()}/handover`, readerToken, "PATCH");
  assert.equal(readerCannotHandover.code, 403);

  const invalidId = await callApi("/api/v1/loans", readerToken, "POST", { bookId: "invalid-id" });
  assert.equal(invalidId.code, 400);

  const absentBook = await callApi("/api/v1/loans", readerToken, "POST", { bookId: new Types.ObjectId().toHexString() });
  assert.equal(absentBook.code, 404);

  const invalidPage = await callApi("/api/v1/loans?page=0", staffToken);
  assert.equal(invalidPage.code, 400);

  assert.equal((await bookModel.findById(bookIds[0]).lean())?.availableCopies, 1);
});

test("HTTP contract: vai trò, đặt–bàn giao–trả–thu phạt và hủy giữ chỗ", async () => {
  const initiallyEmpty = await callApi("/api/v1/loans", readerToken);
  assert.equal(initiallyEmpty.code, 200);
  const initialItems = asRecord(initiallyEmpty.body.data).items;
  assert.ok(Array.isArray(initialItems));
  assert.ok(initialItems.every((item) => asRecord(item).readerAccountId === readerId.toHexString()));

  const reserved = await callApi("/api/v1/loans", readerToken, "POST", { bookId: bookIds[0].toHexString() });
  assert.equal(reserved.code, 201, JSON.stringify(reserved.body));
  const reservedLoan = asRecord(reserved.body.data);
  assert.equal(reservedLoan.status, "PENDING");
  const loanId = String(reservedLoan.loanId);

  const readerList = await callApi("/api/v1/loans?status=PENDING", readerToken);
  assert.equal(readerList.code, 200, JSON.stringify(readerList.body));
  const readerPage = asRecord(readerList.body.data);
  const readerItems = readerPage.items;
  assert.ok(Array.isArray(readerItems));
  assert.equal(readerItems.length, 1);
  assert.equal(asRecord(readerItems[0]).loanId, loanId);
  assert.equal(asRecord(readerItems[0]).status, "PENDING");
  assert.equal(asRecord(readerPage.meta).totalItems, 1);
  assert.ok(Array.isArray(readerPage.records)); // Duy trì contract của frontend hiện tại.
  const otherReaderList = await callApi(`/api/v1/loans?readerId=${readerId}`, otherReaderToken);
  assert.equal(otherReaderList.code, 200);
  assert.deepEqual(asRecord(otherReaderList.body.data).items, []);

  const duplicated = await callApi("/api/v1/loans", readerToken, "POST", { bookId: bookIds[0].toHexString() });
  assert.equal(duplicated.code, 400);
  assert.equal((await bookModel.findById(bookIds[0]).lean())?.availableCopies, 0);

  const mine = await callApi("/api/v1/loans/me", readerToken);
  assert.equal(mine.code, 200, JSON.stringify(mine.body));
  assert.ok(Array.isArray(asRecord(mine.body.data).records));

  const forReader = await callApi(`/api/v1/loans/reader/${readerId}`, staffToken);
  assert.equal(forReader.code, 200, JSON.stringify(forReader.body));

  const all = await callApi("/api/v1/loans?limit=10", staffToken);
  assert.equal(all.code, 200, JSON.stringify(all.body));

  const handover = await callApi(`/api/v1/loans/${loanId}/handover`, staffToken, "PATCH");
  assert.equal(handover.code, 200, JSON.stringify(handover.body));
  assert.equal(asRecord(handover.body.data).status, "BORROWED");

  const repeatHandover = await callApi(`/api/v1/loans/${loanId}/handover`, staffToken, "PATCH");
  assert.equal(repeatHandover.code, 400);

  const invalidDamage = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", { damagePercentage: 101 });
  assert.equal(invalidDamage.code, 400);
  assert.equal((await loanRecordModel.findById(loanId).lean())?.status, "Đang mượn");

  const noPenalty = await callApi(`/api/v1/loans/${loanId}/penalty`, readerToken);
  assert.equal(noPenalty.code, 200, JSON.stringify(noPenalty.body));
  assert.equal(noPenalty.body.data, null);

  const returned = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", { damagePercentage: 10 });
  assert.equal(returned.code, 200, JSON.stringify(returned.body));
  assert.equal(asRecord(asRecord(returned.body.data).loan).status, "Chờ nộp phạt");
  assert.equal(asRecord(returned.body.data).totalPenalty, 10000);

  const repeatReturn = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", { damagePercentage: 10 });
  assert.equal(repeatReturn.code, 409);

  const penalty = await callApi(`/api/v1/loans/${loanId}/penalty`, readerToken);
  assert.equal(penalty.code, 200, JSON.stringify(penalty.body));
  assert.equal(asRecord(penalty.body.data).paymentStatus, "Chờ thanh toán");

  const payment = await callApi(`/api/v1/loans/${loanId}/penalty/payment`, staffToken, "PATCH");
  assert.equal(payment.code, 200, JSON.stringify(payment.body));
  assert.equal(asRecord(asRecord(payment.body.data).loan).status, "Đã trả");

  const repeatPayment = await callApi(`/api/v1/loans/${loanId}/penalty/payment`, staffToken, "PATCH");
  assert.equal(repeatPayment.code, 409);

  const second = await callApi("/api/v1/loans", readerToken, "POST", { bookId: bookIds[1].toHexString() });
  assert.equal(second.code, 201, JSON.stringify(second.body));
  const secondLoanId = String(asRecord(second.body.data).loanId);
  const cancelled = await callApi(`/api/v1/loans/${secondLoanId}/cancel`, readerToken, "PATCH");
  assert.equal(cancelled.code, 200, JSON.stringify(cancelled.body));
  assert.equal(asRecord(cancelled.body.data).status, "CANCELLED");
  assert.equal((await bookModel.findById(bookIds[1]).lean())?.availableCopies, 1);

  const repeatCancel = await callApi(`/api/v1/loans/${secondLoanId}/cancel`, readerToken, "PATCH");
  assert.equal(repeatCancel.code, 400);
  assert.equal((await bookModel.findById(bookIds[1]).lean())?.availableCopies, 1);
});

test("Apidog RESERVE-004/005/006/016/017 và RETURN-026/029: HTTP từ chối và giữ nguyên dữ liệu", async () => {
  const bookId = bookIds[5];
  const bookPath = "/api/v1/loans";
  const body = { bookId: bookId.toHexString() };
  const day = 24 * 60 * 60 * 1000;
  const reservationDate = new Date(Date.now() - 3 * day);
  const reservationExpiryDate = new Date(Date.now() + day);
  const handoverDate = new Date(Date.now() - 2 * day);
  const dueDate = new Date(Date.now() - day);

  // RESERVE-004: dueDate đã qua nhưng scheduler chưa đổi status thành "Quá hạn".
  const overdue = await loanRecordModel.create({
    readerId: otherReaderId, bookId: new Types.ObjectId(), status: "Đang mượn",
    reservationDate, reservationExpiryDate, handoverDate, dueDate,
  });
  const overdueResult = await callApi(bookPath, otherReaderToken, "POST", body);
  assert.equal(overdueResult.code, 400, JSON.stringify(overdueResult.body));
  await loanRecordModel.deleteOne({ _id: overdue._id });

  // RESERVE-005: một phiếu chưa thanh toán tiền phạt vẫn chặn đặt sách.
  const unpaid = await loanRecordModel.create({
    readerId: otherReaderId, bookId: new Types.ObjectId(), status: "Chờ nộp phạt",
    reservationDate, reservationExpiryDate, handoverDate, dueDate,
    actualReturnDate: new Date(),
  });
  const unpaidResult = await callApi(bookPath, otherReaderToken, "POST", body);
  assert.equal(unpaidResult.code, 400, JSON.stringify(unpaidResult.body));
  await loanRecordModel.deleteOne({ _id: unpaid._id });

  // RESERVE-006: khóa thủ công phải được xét ngay cả khi cờ tổng hợp chưa kịp cập nhật.
  await readerModel.updateOne({ _id: otherReaderId }, {
    $set: { isBorrowingManuallyBlocked: true, isBorrowingBlocked: false },
  });
  const manuallyBlocked = await callApi(bookPath, otherReaderToken, "POST", body);
  assert.equal(manuallyBlocked.code, 403, JSON.stringify(manuallyBlocked.body));
  await readerModel.updateOne({ _id: otherReaderId }, {
    $set: { isBorrowingManuallyBlocked: false, isBorrowingBlocked: false },
  });

  // RESERVE-016/017: ID sách hợp lệ nhưng không tồn tại và trường tự gán từ client.
  const absent = await callApi(bookPath, otherReaderToken, "POST", {
    bookId: new Types.ObjectId().toHexString(),
  });
  assert.equal(absent.code, 404, JSON.stringify(absent.body));
  const forged = await callApi(bookPath, otherReaderToken, "POST", {
    ...body, readerAccountId: readerId.toHexString(), status: "BORROWED",
  });
  assert.equal(forged.code, 400, JSON.stringify(forged.body));

  assert.equal((await bookModel.findById(bookId).lean())?.availableCopies, 1);
  assert.equal(await loanRecordModel.countDocuments({ readerId: otherReaderId }), 0);

  const reserved = await callApi(bookPath, otherReaderToken, "POST", body);
  assert.equal(reserved.code, 201, JSON.stringify(reserved.body));
  const loanId = String(asRecord(reserved.body.data).loanId);

  // RETURN-026/029: không nhận trả phiếu đang giữ chỗ, không nhận trường do server quản lý.
  const invalidState = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", {
    condition: "GOOD",
  });
  assert.equal(invalidState.code, 409, JSON.stringify(invalidState.body));
  const forgedReturn = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", {
    condition: "GOOD", actualReturnDate: new Date().toISOString(),
    returnEmployeeId: employeeId.toHexString(), totalPenalty: 0,
  });
  assert.equal(forgedReturn.code, 400, JSON.stringify(forgedReturn.body));
  assert.equal((await loanRecordModel.findById(loanId).lean())?.status, "Đặt lịch mượn");
  assert.equal((await bookModel.findById(bookId).lean())?.availableCopies, 0);

  const cancelled = await callApi(`/api/v1/loans/${loanId}/cancel`, otherReaderToken, "PATCH");
  assert.equal(cancelled.code, 200, JSON.stringify(cancelled.body));
  assert.equal((await bookModel.findById(bookId).lean())?.availableCopies, 1);
});

test("HTTP RESERVE-018/019: tranh bản cuối và hai request đặt trùng không tạo phiếu dư", async () => {
  const [firstReader, secondReader] = await Promise.all([createQaReader(), createQaReader()]);
  const lastCopy = await createQaBook("last copy");
  const contested = await Promise.all([
    reserveViaHttp(lastCopy, firstReader.token),
    reserveViaHttp(lastCopy, secondReader.token),
  ]);
  assert.deepEqual(contested.map(result => result.code).sort(), [201, 400]);
  assert.equal(await loanRecordModel.countDocuments({ bookId: lastCopy, status: "Đặt lịch mượn" }), 1);
  assert.equal((await bookModel.findById(lastCopy).lean())?.availableCopies, 0);

  const twoCopies = await createQaBook("duplicate reservation", 2);
  const repeated = await Promise.all([
    reserveViaHttp(twoCopies, firstReader.token),
    reserveViaHttp(twoCopies, firstReader.token),
  ]);
  assert.deepEqual(repeated.map(result => result.code).sort(), [201, 400]);
  assert.equal(await loanRecordModel.countDocuments({ readerId: firstReader.id, bookId: twoCopies, status: "Đặt lịch mượn" }), 1);
  assert.equal((await bookModel.findById(twoCopies).lean())?.availableCopies, 1);
});

test("HTTP RESERVE-020: hai request tranh suất thứ ba chỉ một request thành công", async () => {
  const reader = await createQaReader();
  const books = await Promise.all(Array.from({ length: 4 }, (_, i) => createQaBook(`third slot ${i}`)));
  for (const id of books.slice(0, 2)) getLoanId(await reserveViaHttp(id, reader.token));

  const results = await Promise.all(books.slice(2).map(id => reserveViaHttp(id, reader.token)));
  assert.deepEqual(results.map(result => result.code).sort(), [201, 400]);
  assert.equal(await loanRecordModel.countDocuments({
    readerId: reader.id, status: { $in: ["Đặt lịch mượn", "Đang mượn"] },
  }), 3);
  const remaining = await Promise.all(books.map(id => bookModel.findById(id).lean()));
  assert.equal(remaining.reduce((sum, book) => sum + (book?.availableCopies ?? 0), 0), 1);
});

test("HTTP CANCEL-009/HANDOVER-008: hủy đồng thời và hủy tranh bàn giao chỉ quyết toán một lần", async () => {
  const reader = await createQaReader();
  const cancelBook = await createQaBook("double cancel");
  const cancelId = getLoanId(await reserveViaHttp(cancelBook, reader.token));
  const cancelled = await Promise.all([
    callApi(`/api/v1/loans/${cancelId}/cancel`, reader.token, "PATCH"),
    callApi(`/api/v1/loans/${cancelId}/cancel`, reader.token, "PATCH"),
  ]);
  assert.equal(cancelled.filter(result => result.code === 200).length, 1);
  assert.ok(cancelled.some(result => [400, 409].includes(result.code)));
  assert.equal((await bookModel.findById(cancelBook).lean())?.availableCopies, 1);
  assert.equal((await loanRecordModel.findById(cancelId).lean())?.status, "Đã huỷ");

  const competingBook = await createQaBook("cancel vs handover");
  const competingId = getLoanId(await reserveViaHttp(competingBook, reader.token));
  const contenders = await Promise.all([
    callApi(`/api/v1/loans/${competingId}/cancel`, reader.token, "PATCH"),
    callApi(`/api/v1/loans/${competingId}/handover`, staffToken, "PATCH"),
  ]);
  assert.equal(contenders.filter(result => result.code === 200).length, 1);
  assert.ok(contenders.some(result => [400, 409].includes(result.code)));
  const finalLoan = await loanRecordModel.findById(competingId).lean();
  const finalBook = await bookModel.findById(competingBook).lean();
  assert.ok(["Đã huỷ", "Đang mượn"].includes(String(finalLoan?.status)));
  assert.equal(finalBook?.availableCopies, finalLoan?.status === "Đã huỷ" ? 1 : 0);
});

test("HTTP RETURN-031: hai request nhận trả chỉ tạo một phiếu phạt", async () => {
  const reader = await createQaReader();
  const bookId = await createQaBook("double return");
  const loanId = getLoanId(await reserveViaHttp(bookId, reader.token));
  assert.equal((await callApi(`/api/v1/loans/${loanId}/handover`, staffToken, "PATCH")).code, 200);
  await loanRecordModel.updateOne({ _id: loanId }, { $set: { dueDate: new Date(Date.now() - 86400000) } });

  const results = await Promise.all(Array.from({ length: 2 }, () =>
    callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", { condition: "GOOD" }),
  ));
  assert.deepEqual(results.map(result => result.code).sort(), [200, 409]);
  assert.equal(await penaltyRecordModel.countDocuments({ loanRecordId: loanId }), 1);
  assert.equal((await loanRecordModel.findById(loanId).lean())?.status, "Chờ nộp phạt");
  assert.equal((await bookModel.findById(bookId).lean())?.availableCopies, 0);
});

test("HTTP COLLECT-026/027: thu phạt đồng thời, retry sau khi nhận tiền và kiểm tra trạng thái", async () => {
  const reader = await createQaReader();
  const bookId = await createQaBook("double collect");
  const loanId = getLoanId(await reserveViaHttp(bookId, reader.token));
  assert.equal((await callApi(`/api/v1/loans/${loanId}/handover`, staffToken, "PATCH")).code, 200);
  await loanRecordModel.updateOne({ _id: loanId }, { $set: { dueDate: new Date(Date.now() - 86400000) } });
  const returned = await callApi(`/api/v1/loans/${loanId}/return`, staffToken, "PATCH", { condition: "GOOD" });
  assert.equal(returned.code, 200, JSON.stringify(returned.body));
  const penalty = await penaltyRecordModel.findOne({ loanRecordId: loanId }).lean();
  assert.ok(penalty);

  const path = `/api/v1/penalties/${penalty._id}/collect`;
  const payment = { confirmFullCashReceived: true, expectedTotalPenalty: penalty.totalPenalty };
  const results = await Promise.all(Array.from({ length: 2 }, () =>
    callApi(path, staffToken, "PATCH", payment),
  ));
  assert.deepEqual(results.map(result => result.code).sort(), [200, 409]);
  assert.equal((await penaltyRecordModel.findById(penalty._id).lean())?.paymentStatus, "Đã thanh toán");
  assert.equal((await loanRecordModel.findById(loanId).lean())?.status, "Đã trả");
  assert.equal((await bookModel.findById(bookId).lean())?.availableCopies, 1);
  assert.equal((await callApi(path, staffToken, "PATCH", payment)).code, 409);
  const detail = await callApi(`/api/v1/penalties/${penalty._id}`, staffToken);
  assert.equal(detail.code, 200, JSON.stringify(detail.body));
  assert.equal(asRecord(detail.body.data).paymentStatus, "PAID");
  assert.equal((await penaltyRecordModel.countDocuments({ loanRecordId: loanId })), 1);
});

test("HTTP LOAN-LIST-011: nhân viên thiếu MANAGE_LOANS không xem được danh sách", async () => {
  const limitedStaffToken = await createQaEmployeeWithoutLoanPermission();
  const forbidden = await callApi("/api/v1/loans?page=1&limit=10", limitedStaffToken);
  assert.equal(forbidden.code, 403, JSON.stringify(forbidden.body));
  assert.equal(forbidden.body.status, "error");
  assert.equal(forbidden.body.data, null);

  const allowed = await callApi("/api/v1/loans?page=1&limit=10", staffToken);
  assert.equal(allowed.code, 200, JSON.stringify(allowed.body));
  assert.ok(Array.isArray(asRecord(allowed.body.data).items));
});

test("HTTP PENALTY-LIST-007: phân trang giữ thứ tự issuedDate giảm, penaltyId tăng khi bằng ngày", async () => {
  const reader = await createQaReader();
  const books = await Promise.all(Array.from({ length: 4 }, (_, i) => createQaBook(`penalty sorting ${i}`)));
  const dated = new Date("2026-11-01T00:00:00.000Z");
  const newer = new Date("2026-11-02T00:00:00.000Z");
  const loans = await Promise.all(books.map(bookId => loanRecordModel.create({
    readerId: reader.id, bookId, status: "Chờ nộp phạt",
    reservationDate: new Date("2026-10-25T00:00:00.000Z"),
    reservationExpiryDate: new Date("2026-10-26T00:00:00.000Z"),
    handoverDate: new Date("2026-10-27T00:00:00.000Z"),
    dueDate: new Date("2026-10-31T00:00:00.000Z"),
    actualReturnDate: new Date("2026-11-01T00:00:00.000Z"),
  })));
  const penalties = await Promise.all(loans.map((loan, i) => penaltyRecordModel.create({
    loanRecordId: loan._id,
    issuedDate: i === 3 ? newer : dated,
    appliedCoverPrice: 100000, overdueFee: 5000, totalPenalty: 5000,
    paymentStatus: "Chờ thanh toán",
  })));
  const query = `/api/v1/penalties?readerAccountId=${reader.id}&limit=2`;
  const [page1, page2, again] = await Promise.all([
    callApi(`${query}&page=1`, staffToken),
    callApi(`${query}&page=2`, staffToken),
    callApi(`${query}&page=1`, staffToken),
  ]);
  for (const response of [page1, page2, again]) {
    assert.equal(response.code, 200, JSON.stringify(response.body));
    assert.equal(asRecord(asRecord(response.body.data).meta).totalItems, 4);
  }
  const extractIds = (response: { body: ApiResult }) => {
    const items = asRecord(response.body.data).items;
    assert.ok(Array.isArray(items));
    return items.map(item => String(asRecord(item).penaltyId));
  };
  const actual = [...extractIds(page1), ...extractIds(page2)];
  const expected = [penalties[3].id, ...penalties.slice(0, 3).map(p => p.id).sort()];
  assert.deepEqual(actual, expected);
  assert.deepEqual(extractIds(again), extractIds(page1));
  assert.equal(new Set(actual).size, 4);
});
