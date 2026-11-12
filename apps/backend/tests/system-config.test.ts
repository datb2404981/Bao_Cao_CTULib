import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { Types } from "mongoose";
import { AccountModel } from "../src/models/user.model.js";
import systemConfigModel from "../src/models/systemConfig.model.js";
import systemConfigRouter from "../src/routes/systemConfig.route.js";
import { createSystemConfig, getLoanDuration, updateSystemConfig } from "../src/services/systemConfig.service.js";
import { generateAccessToken } from "../src/utils/jwt.util.js";
import { AppError } from "../src/utils/app-error.js";

process.env.ACCESS_TOKEN_SECRET_KEY = "system-config-test-secret-32-characters";

const id = new Types.ObjectId();
const app = express();
app.use(express.json());
app.use("/config", systemConfigRouter);
const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  res.status(error instanceof AppError ? error.statusCode : 500).json({
    status: "error", message: error instanceof Error ? error.message : "Lỗi hệ thống", data: null,
  });
};
app.use(handleError);

const server = app.listen(0, "127.0.0.1");
let base: string;

before(async () => {
  if (!server.listening) await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
afterEach(() => mock.restoreAll());

const token = () => generateAccessToken({
  accountId: id.toHexString(), ctuIdentifier: "ADMIN-TEST", role: "ADMIN",
});

const stubDatabase = (role = "ADMIN") => {
  const stored = new Map<string, number | string>([
    ["loanDuration", 7], ["maxBorrowLimit", 3], ["overdueFeePerDay", 5000],
  ]);
  mock.method(AccountModel, "findById", () => ({
    select: () => ({ lean: async () => ({ role, isActive: true }) }),
  }));
  const update = mock.method(systemConfigModel, "findOneAndUpdate", async (
    filter: { key: string }, changes: { $set: { value: number | string } },
  ) => {
    stored.set(filter.key, changes.$set.value);
    return { key: filter.key, value: changes.$set.value };
  });
  const create = mock.method(systemConfigModel, "create", async (input: { key: string; value: number | string }) => {
    stored.set(input.key, input.value);
    return input;
  });
  mock.method(systemConfigModel, "findOne", (filter: { key: string }) => ({
    lean: async () => stored.has(filter.key) ? { key: filter.key, value: stored.get(filter.key) } : null,
  }));
  return { stored, update, create };
};

const send = async (method: "PUT" | "POST", path: string, data: unknown, accessToken = token()) => {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(data),
  });
  return { code: response.status, body: await response.json() };
};

test("QA-CONFIG-001: PUT loanDuration sai kiểu/âm/vượt biên trả 400 và không ghi", async () => {
  const { stored, update } = stubDatabase();
  for (const value of [-5, "qa-not-a-number", 0, 91, 2.5, null, true]) {
    const result = await send("PUT", "/config/loanDuration", { value });
    assert.equal(result.code, 400, `Giá trị ${JSON.stringify(value)}`);
    assert.equal(result.body.status, "error");
    assert.equal(result.body.data, null);
    assert.equal(stored.get("loanDuration"), 7);
  }
  assert.equal(update.mock.callCount(), 0);
  assert.equal(await getLoanDuration(), 7);
});

test("QA-CONFIG-002: POST/PUT thiếu value trả 400 và không tạo/cập nhật", async () => {
  const { stored, update, create } = stubDatabase();
  const post = await send("POST", "/config", { key: "qa_missing_value" });
  const put = await send("PUT", "/config/loanDuration", {});
  assert.equal(post.code, 400);
  assert.equal(put.code, 400);
  assert.equal(post.body.status, "error");
  assert.equal(post.body.data, null);
  assert.equal(stored.has("qa_missing_value"), false);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
});

test("Các khóa nghiệp vụ áp dụng cùng giới hạn với trang Settings", async () => {
  const { stored, update, create } = stubDatabase();
  for (const [key, value] of [
    ["maxBorrowLimit", 0], ["maxBorrowLimit", 11], ["maxBorrowLimit", 1.5],
    ["overdueFeePerDay", 999], ["overdueFeePerDay", 1500], ["overdueFeePerDay", "5000"],
  ] as const) {
    assert.equal((await send("PUT", `/config/${key}`, { value })).code, 400);
    assert.equal((await send("POST", "/config", { key, value })).code, 400);
  }
  assert.equal(stored.get("maxBorrowLimit"), 3);
  assert.equal(stored.get("overdueFeePerDay"), 5000);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
});

test("Admin ghi được biên hợp lệ và key tùy chỉnh", async () => {
  const { stored, update, create } = stubDatabase();
  for (const [key, value] of [
    ["loanDuration", 1], ["loanDuration", 90],
    ["maxBorrowLimit", 1], ["maxBorrowLimit", 10],
    ["overdueFeePerDay", 1000], ["overdueFeePerDay", 5000],
  ] as const) {
    const response = await send("PUT", `/config/${key}`, { value });
    assert.equal(response.code, 200);
    assert.equal(stored.get(key), value);
  }
  const response = await send("POST", "/config", {
    key: "qa_custom_key", value: "enabled", description: "Cấu hình QA",
  });
  assert.equal(response.code, 201);
  assert.equal(stored.get("qa_custom_key"), "enabled");
  assert.equal(update.mock.callCount(), 6);
  assert.equal(create.mock.callCount(), 1);
});

test("Kiểm soát quyền được thực hiện trước validation", async () => {
  stubDatabase("READER");
  const reader = await send("PUT", "/config/loanDuration", { value: -5 });
  assert.equal(reader.code, 403);
  const guest = await fetch(base + "/config/loanDuration", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: -5 }),
  });
  assert.equal(guest.status, 401);
});

test("Service tự từ chối giá trị sai và getter phòng dữ liệu cũ bị hỏng", async () => {
  const { stored, update, create } = stubDatabase();
  await assert.rejects(updateSystemConfig({ key: "loanDuration", value: -5 }),
    (error: unknown) => error instanceof AppError && error.statusCode === 400);
  await assert.rejects(createSystemConfig({ key: "loanDuration", value: "abc" }),
    (error: unknown) => error instanceof AppError && error.statusCode === 400);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
  stored.set("loanDuration", "qa-not-a-number");
  assert.equal(await getLoanDuration(), 7);
  stored.set("loanDuration", -5);
  assert.equal(await getLoanDuration(), 7);
});
