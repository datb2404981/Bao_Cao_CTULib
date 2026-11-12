import assert from "node:assert/strict";
import { test } from "node:test";
import { registerSchema } from "../src/schemas/auth.schema.js";

const validRegistration = {
  ctuIdentifier: "B2101234",
  email: "reader@example.com",
  password: "StrongPass123",
};

test("đăng ký chấp nhận email thông thường hợp lệ và mật khẩu đủ dài", () => {
  assert.equal(registerSchema.safeParse(validRegistration).success, true);
  assert.equal(registerSchema.safeParse({ ...validRegistration, email: "reader@student.ctu.edu.vn" }).success, true);
});

test("đăng ký từ chối email với phần tên miền chỉ có chữ số", () => {
  assert.equal(registerSchema.safeParse({ ...validRegistration, email: "test@123.com" }).success, false);
  assert.equal(registerSchema.safeParse({ ...validRegistration, email: "wrong-email" }).success, false);
});

test("đăng ký từ chối mật khẩu toàn dấu cách hoặc dưới 8 ký tự hữu dụng", () => {
  for (const password of ["     ", "            ", " 1234567 ", "short"]) {
    assert.equal(registerSchema.safeParse({ ...validRegistration, password }).success, false, password);
  }
  assert.equal(registerSchema.safeParse({ ...validRegistration, password: " 12345678 " }).success, true);
});
