import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { createReaderSchema, updateReaderSchema } from "../src/schemas/reader.schema.js";
import { createEmployeeSchema } from "../src/schemas/employee.schema.js";
import { permissionSchema } from "../src/schemas/permission.schema.js";
import { requireAdmin } from "../src/middlewares/admin.middleware.js";
import { AccountModel } from "../src/models/user.model.js";
import { AppError } from "../src/utils/app-error.js";

const id = "507f1f77bcf86cd799439011";
test("kiểm tra dữ liệu hồ sơ và quyền", () => {
  assert.equal(createReaderSchema.safeParse({ accountId: id, facultyId: id, readerType: "STAFF" }).success, true);
  assert.equal(createReaderSchema.safeParse({ accountId: id, facultyId: id, readerType: "OTHER" }).success, false);
  assert.equal(createReaderSchema.safeParse({ accountId: id, facultyId: id, dateOfBirth: "2999-01-01" }).success, false);
  assert.equal(updateReaderSchema.safeParse({ isBorrowingBlocked: false }).success, false);
  assert.equal(createEmployeeSchema.safeParse({ accountId: id, permissionIds: [id, id.toUpperCase()] }).success, false);
  assert.equal(permissionSchema.safeParse({ permissionName: " ", description: "Mô tả" }).success, false);
});

test("chỉ tài khoản ADMIN đang hoạt động mới qua middleware", async () => {
  const original = AccountModel.findById;
  try {
    for (const [account, allowed] of [[{ role: "ADMIN", isActive: true }, true], [{ role: "EMPLOYEE", isActive: true }, false], [{ role: "ADMIN", isActive: false }, false], [null, false]] as const) {
      AccountModel.findById = (() => ({ select: () => ({ lean: async () => account }) })) as unknown as typeof AccountModel.findById;
      let result: unknown = "not called";
      await requireAdmin({ user: { accountId: id } } as Request, {} as Response, ((error?: unknown) => { result = error; }) as NextFunction);
      if (allowed) assert.equal(result, undefined);
      else assert.ok(result instanceof AppError);
    }
  } finally { AccountModel.findById = original; }
});
