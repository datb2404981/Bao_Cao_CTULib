import assert from "node:assert/strict";
import express from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";

// Thiết lập env
process.env.ACCESS_TOKEN_SECRET_KEY = "test-access-token-secret-key-32-chars-long";
process.env.CLIENT_URL = "http://localhost:5173";

const { app } = await import("../dist/app.js");
const { BookModel } = await import("../dist/models/book.model.js");
const { facultyModel } = await import("../dist/models/faculty.model.js");
const { default: authorModel } = await import("../dist/models/author.model.js");

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

// Helper tạo JWT token
const createToken = ({ accountId, ctuIdentifier, role, expired = false }) => {
  return jwt.sign(
    { accountId, ctuIdentifier, role },
    process.env.ACCESS_TOKEN_SECRET_KEY,
    {
      algorithm: "HS256",
      expiresIn: expired ? -10 : 900,
      subject: accountId,
      issuer: "ctulib-api",
      audience: "ctulib-web",
    }
  );
};

const tokenEBook = createToken({
  accountId: new Types.ObjectId().toHexString(),
  ctuIdentifier: "CB99101",
  role: "EMPLOYEE",
});
const tokenReader = createToken({
  accountId: new Types.ObjectId().toHexString(),
  ctuIdentifier: "B9900001",
  role: "READER",
});
const tokenAdminNone = createToken({
  accountId: new Types.ObjectId().toHexString(),
  ctuIdentifier: "ADMIN99101",
  role: "ADMIN",
});
const tokenEReturn = createToken({
  accountId: new Types.ObjectId().toHexString(),
  ctuIdentifier: "CB99103",
  role: "EMPLOYEE",
});
const tokenExpired = createToken({
  accountId: new Types.ObjectId().toHexString(),
  ctuIdentifier: "CB99101",
  role: "EMPLOYEE",
  expired: true,
});
const tokenBadSignature = tokenEBook.slice(0, -5) + "abcde";

const faculty1 = new Types.ObjectId().toHexString();
const author1 = new Types.ObjectId().toHexString();
const author2 = new Types.ObjectId().toHexString();

// Mock database models
facultyModel.exists = async ({ _id }) => (_id.toString() === faculty1 ? { _id } : null);
authorModel.countDocuments = async ({ _id: { $in: ids } }) => {
  const valid = [author1, author2];
  return ids.filter((id) => valid.includes(id.toString())).length;
};
authorModel.find = () => ({
  select: async () => [{ _id: new Types.ObjectId(author1) }],
});

const inMemoryBooks = [];
BookModel.exists = async ({ title }) => inMemoryBooks.some((b) => b.title === title);
BookModel.create = async (doc) => {
  const created = {
    _id: new Types.ObjectId(),
    ...doc,
    toObject() {
      return this;
    },
  };
  inMemoryBooks.push(created);
  return created;
};
BookModel.findById = async (id) => {
  const found = inMemoryBooks.find((b) => b._id.toString() === id.toString());
  return found ? { ...found, toObject() { return this; } } : null;
};
BookModel.countDocuments = async (filter) => inMemoryBooks.length;
BookModel.find = (filter) => {
  let res = [...inMemoryBooks];
  return {
    skip(s) {
      res = res.slice(s);
      return this;
    },
    limit(l) {
      res = res.slice(0, l);
      return Promise.resolve(res.map((b) => ({ ...b, toObject() { return this; } })));
    },
  };
};

// Seed 12 cuốn sách cho test GET danh sách
for (let i = 1; i <= 12; i++) {
  inMemoryBooks.push({
    _id: new Types.ObjectId(),
    title: `Giáo trình Web ${i}`,
    facultyId: new Types.ObjectId(faculty1),
    authorIds: [new Types.ObjectId(author1)],
    bookType: "TEXTBOOK",
    totalCopies: 10,
    availableCopies: 10,
    coverPrice: 50000,
    isAvailableForCirculation: true,
  });
}

const testResults = [];

async function runTest(caseId, description, fn) {
  try {
    await fn();
    testResults.push({ caseId, description, status: "PASS" });
    console.log(`[PASS] ${caseId}: ${description}`);
  } catch (error) {
    testResults.push({ caseId, description, status: "FAIL", error: error.message });
    console.error(`[FAIL] ${caseId}: ${description} -> ${error.message}`);
  }
}

// 1. Tests POST /books
await runTest("AUTH-004", "Thiếu token tại /books -> 401", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Sách mới", facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: 1000 }),
  });
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.status, "error");
});

await runTest("AUTH-005", "Token sai chữ ký tại /books -> 401", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenBadSignature}` },
    body: JSON.stringify({ title: "Sách mới", facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: 1000 }),
  });
  assert.equal(res.status, 401);
});

await runTest("AUTH-006", "Token hết hạn tại /books -> 401", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenExpired}` },
    body: JSON.stringify({ title: "Sách mới", facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: 1000 }),
  });
  assert.equal(res.status, 401);
});

await runTest("BOOK-CREATE-002", "Không có MANAGE_BOOKS: READER -> 403", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenReader}` },
    body: JSON.stringify({ title: "Sách mới", facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: 1000 }),
  });
  assert.equal(res.status, 403);
});

await runTest("BOOK-CREATE-003", "Không có MANAGE_BOOKS: ADMIN_NONE -> 403", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenAdminNone}` },
    body: JSON.stringify({ title: "Sách mới", facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: 1000 }),
  });
  assert.equal(res.status, 403);
});

await runTest("BOOK-CREATE-004", "Không có MANAGE_BOOKS: E_RETURN -> 403", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEReturn}` },
    body: JSON.stringify({ title: "Sách mới", facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: 1000 }),
  });
  assert.equal(res.status, 403);
});

await runTest("BOOK-CREATE-001", "Thêm sách có quyền -> 201", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({
      title: "Giáo trình kiểm thử",
      facultyId: faculty1,
      authorIds: [author1],
      bookType: "TEXTBOOK",
      totalCopies: 5,
      coverPrice: 100000,
    }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.status, "success");
  assert.equal(json.message, "Thêm thành công");
  assert.ok(json.data.bookId);
  assert.equal(json.data.availableCopies, 5);
});

await runTest("BOOK-CREATE-022", "Client cố gán availableCopies: 999 -> server tự tính = totalCopies", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({
      title: "Sách 999 bản",
      facultyId: faculty1,
      authorIds: [author1],
      totalCopies: 5,
      coverPrice: 100000,
      availableCopies: 999,
    }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.data.availableCopies, 5);
});

await runTest("BOOK-CREATE-005", "Thiếu trường title -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: 100000 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-011", "Tác giả lặp -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách lặp tg", facultyId: faculty1, authorIds: [author1, author1], totalCopies: 5, coverPrice: 100000 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-012", "Số bản âm -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách bản âm", facultyId: faculty1, authorIds: [author1], totalCopies: -1, coverPrice: 100000 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-013", "Số bản không nguyên -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách bản lẻ", facultyId: faculty1, authorIds: [author1], totalCopies: 1.5, coverPrice: 100000 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-014", "Giá âm -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách giá âm", facultyId: faculty1, authorIds: [author1], totalCopies: 5, coverPrice: -100 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-015", "Loại sách ngoài enum -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách enum", facultyId: faculty1, authorIds: [author1], bookType: "COMIC", totalCopies: 5, coverPrice: 100 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-016", "Ảnh sai URI -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách ảnh sai", facultyId: faculty1, authorIds: [author1], coverImageUrl: "not-a-url", totalCopies: 5, coverPrice: 100 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-019", "Khoa không tồn tại -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách khoa sai", facultyId: new Types.ObjectId().toHexString(), authorIds: [author1], totalCopies: 5, coverPrice: 100 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-020", "Tác giả không tồn tại -> 400", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách tg sai", facultyId: faculty1, authorIds: [new Types.ObjectId().toHexString()], totalCopies: 5, coverPrice: 100 }),
  });
  assert.equal(res.status, 400);
});

await runTest("BOOK-CREATE-021", "Tạo sách 0 bản và giá 0 -> 201", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách 0 bản 0 đồng", facultyId: faculty1, authorIds: [author1], totalCopies: 0, coverPrice: 0 }),
  });
  assert.equal(res.status, 201);
});

await runTest("BOOK-CREATE-023", "Bỏ bookType tùy chọn -> 201, default TEXTBOOK", async () => {
  const res = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenEBook}` },
    body: JSON.stringify({ title: "Sách no bookType", facultyId: faculty1, authorIds: [author1], totalCopies: 1, coverPrice: 1000 }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.data.bookType, "TEXTBOOK");
});

// 2. Tests GET /books
await runTest("BOOK-LIST-001", "Đọc danh sách sách -> 200, phân trang", async () => {
  const res = await fetch(`${baseUrl}/books?page=1&limit=10`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, "success");
  assert.equal(json.message, "Lấy danh sách thành công");
  assert.ok(Array.isArray(json.data.items));
  assert.ok(json.data.items.length <= 10);
  assert.equal(json.data.meta.currentPage, 1);
  assert.equal(json.data.meta.limit, 10);
  assert.ok(json.data.meta.totalItems >= 12);
  for (const b of json.data.items) {
    assert.ok(typeof b.bookId === "string" && b.bookId.length > 0);
  }
});

await runTest("BOOK-LIST-007", "Phân trang sai: page=0 -> 400", async () => {
  const res = await fetch(`${baseUrl}/books?page=0`);
  assert.equal(res.status, 400);
});

await runTest("BOOK-LIST-009", "Phân trang sai: page=1.5 -> 400", async () => {
  const res = await fetch(`${baseUrl}/books?page=1.5`);
  assert.equal(res.status, 400);
});

await runTest("BOOK-LIST-010", "Phân trang sai: page=abc -> 400", async () => {
  const res = await fetch(`${baseUrl}/books?page=abc`);
  assert.equal(res.status, 400);
});

await runTest("BOOK-LIST-011", "Phân trang sai: limit=0 -> 400", async () => {
  const res = await fetch(`${baseUrl}/books?limit=0`);
  assert.equal(res.status, 400);
});

await runTest("BOOK-LIST-013", "Phân trang sai: limit=1.5 -> 400", async () => {
  const res = await fetch(`${baseUrl}/books?limit=1.5`);
  assert.equal(res.status, 400);
});

await runTest("BOOK-LIST-014", "Phân trang sai: limit=abc -> 400", async () => {
  const res = await fetch(`${baseUrl}/books?limit=abc`);
  assert.equal(res.status, 400);
});

// 3. Tests GET /books/{bookId}
const validBookId = inMemoryBooks[0]._id.toString();

await runTest("AUTH-007", "Thiếu token tại /books/{bookId} -> 401", async () => {
  const res = await fetch(`${baseUrl}/books/${validBookId}`);
  assert.equal(res.status, 401);
});

await runTest("AUTH-008", "Token sai chữ ký tại /books/{bookId} -> 401", async () => {
  const res = await fetch(`${baseUrl}/books/${validBookId}`, {
    headers: { Authorization: `Bearer ${tokenBadSignature}` },
  });
  assert.equal(res.status, 401);
});

await runTest("AUTH-009", "Token hết hạn tại /books/{bookId} -> 401", async () => {
  const res = await fetch(`${baseUrl}/books/${validBookId}`, {
    headers: { Authorization: `Bearer ${tokenExpired}` },
  });
  assert.equal(res.status, 401);
});

await runTest("BOOK-DETAIL-001", "Xem sách hợp lệ -> 200", async () => {
  const res = await fetch(`${baseUrl}/books/${validBookId}`, {
    headers: { Authorization: `Bearer ${tokenReader}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, "success");
  assert.equal(json.message, "Chi tiết ấn phẩm");
  assert.equal(json.data.bookId, validBookId);
});

await runTest("BOOK-DETAIL-002", "Sách không tồn tại -> 404", async () => {
  const nonExisting = new Types.ObjectId().toHexString();
  const res = await fetch(`${baseUrl}/books/${nonExisting}`, {
    headers: { Authorization: `Bearer ${tokenReader}` },
  });
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.status, "error");
  assert.equal(json.message, "Sách không tồn tại");
});

server.close();

console.log("\n=================================");
console.log(`TOTAL: ${testResults.length} test cases`);
console.log(`PASSED: ${testResults.filter((r) => r.status === "PASS").length}`);
console.log(`FAILED: ${testResults.filter((r) => r.status === "FAIL").length}`);
console.log("=================================");
if (testResults.some((r) => r.status === "FAIL")) {
  process.exit(1);
}

