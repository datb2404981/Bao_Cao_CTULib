import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import express, { type ErrorRequestHandler } from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { AccountModel } from "../src/models/user.model.js";
import employeeModel from "../src/models/employee.model.js";
import permissionModel from "../src/models/permission.model.js";
import BookModel from "../src/models/book.model.js";
import facultyModel from "../src/models/faculty.model.js";
import authorModel from "../src/models/author.model.js";
import { createBook } from "../src/services/book.service.js";
import { bookSchema } from "../src/schemas/book.schema.js";
import bookRouter from "../src/routes/book.route.js";
import { AppError } from "../src/utils/app-error.js";

process.env.ACCESS_TOKEN_SECRET_KEY = "test-secret-key-32-chars-at-least";
process.env.CLIENT_URL = "http://localhost:5173";

const faculty = new Types.ObjectId().toHexString();
const author = new Types.ObjectId().toHexString();

const input = {
  title: "Lập trình Web",
  bookType: "TEXTBOOK" as const,
  publisher: "NXB Đại học",
  publicationYear: 2025,
  coverPrice: 150000,
  totalCopies: 5,
  facultyId: faculty,
  authorIds: [author],
};

const app = express();
app.use(express.json());
app.use("/book", bookRouter);
const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    status: "error",
    message: error.message,
    data: null,
  });
};
app.use(handleError);

const server = app.listen(0, "127.0.0.1");
let base: string;

before(async () => {
  await new Promise<void>((resolve, reject) => {
    if (server.listening) return resolve();
    server.once("listening", resolve);
    server.once("error", reject);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
afterEach(() => mock.restoreAll());

const createToken = (ctuIdentifier = "CB99101", role = "EMPLOYEE") => {
  const accountId = new Types.ObjectId().toHexString();
  mock.method(AccountModel, "findById", () => ({ select: () => ({ lean: async () => ({ _id: new Types.ObjectId(accountId), role, isActive: true, ctuIdentifier, email: "test@example.com" }) }) }));
  mock.method(employeeModel, "findById", () => ({ lean: async () => ({ permissionIds: [new Types.ObjectId()] }) }));
  mock.method(permissionModel, "find", () => ({ select: () => ({ lean: async () => [{ permissionName: "MANAGE_BOOKS" }] }) }));
  return jwt.sign(
    { accountId, ctuIdentifier, role },
    process.env.ACCESS_TOKEN_SECRET_KEY!,
    {
      algorithm: "HS256",
      expiresIn: 900,
      subject: accountId,
      issuer: "ctulib-api",
      audience: "ctulib-web",
    }
  );
};

const post = (body: unknown, token?: string) =>
  fetch(base + "/book", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const existingRelations = () => {
  mock.method(facultyModel, "exists", async () => ({ _id: new Types.ObjectId(faculty) }));
  mock.method(authorModel, "countDocuments", async () => 1);
};

test("schema đồng bộ TEXTBOOK, mặc định lưu thông và ràng buộc số bản", () => {
  const parsed = bookSchema.parse(input);
  assert.equal(parsed.isAvailableForCirculation, true);
  for (const invalid of [
    { ...input, totalCopies: -1 },
    { ...input, coverPrice: -1 },
    { ...input, bookType: "TEXTBOOOK" },
    { ...input, facultyId: "invalid" },
    { ...input, authorIds: [] },
  ]) {
    assert.equal(bookSchema.safeParse(invalid).success, false);
  }
});

test("service chặn khoa không tồn tại trước khi tạo sách", async () => {
  mock.method(facultyModel, "exists", async () => null);
  mock.method(authorModel, "countDocuments", async () => 1);
  const create = mock.method(BookModel, "create", async () => {
    throw new Error("Unexpected write");
  });
  await assert.rejects(createBook(input), (error) => error instanceof AppError && error.statusCode === 400);
  assert.equal(create.mock.callCount(), 0);
});

test("POST tạo sách trả 201 theo chuẩn Apidog (message: 'Thêm thành công')", async () => {
  existingRelations();
  const token = createToken("CB99101", "EMPLOYEE");
  const bookId = new Types.ObjectId();
  const saved = {
    _id: bookId,
    ...input,
    availableCopies: 5,
    toObject() {
      return this;
    },
  };
  const create = mock.method(BookModel, "create", async () => saved);
  const response = await post(input, token);
  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.status, "success");
  assert.equal(json.message, "Thêm thành công");
  assert.equal(json.data.bookId, bookId.toString());
  assert.equal(json.data.availableCopies, 5);
  assert.equal(create.mock.callCount(), 1);
});

test("POST thiếu token trả 401", async () => {
  const response = await post(input);
  assert.equal(response.status, 401);
});

test("POST quyền READER trả 403", async () => {
  const token = createToken("B9900001", "READER");
  const response = await post(input, token);
  assert.equal(response.status, 403);
});
