import assert from 'node:assert/strict';
import { after, before, afterEach, mock, test } from 'node:test';
import express, { type ErrorRequestHandler, type NextFunction, type Response } from 'express';
import type { AddressInfo } from 'node:net';
import authRouter from '../src/routes/auth.route.js';
import readerRouter from '../src/routes/reader.route.js';
import employeeRouter from '../src/routes/employee.route.js';
import permissionRouter from '../src/routes/permission.route.js';
import facultyRouter from '../src/routes/faculty.route.js';
import authorRouter from '../src/routes/author.route.js';
import { generateAccessToken } from '../src/utils/jwt.util.js';
import { Types } from 'mongoose';
import { AccountModel } from '../src/models/user.model.js';
import employeeModel from '../src/models/employee.model.js';
import permissionModel from '../src/models/permission.model.js';
import { getAccountAccess } from '../src/services/access.service.js';
import { requirePermission } from '../src/middlewares/permission.middleware.js';
import type { AuthenticatedRequest } from '../src/middlewares/auth.middleware.js';
import { AppError } from '../src/utils/app-error.js';

const id = new Types.ObjectId();
const permissionId = new Types.ObjectId();
afterEach(() => mock.restoreAll());
const stubAccess = (role: string, permissions: string[] = [], isActive = true) => {
  mock.method(AccountModel, 'findById', () => ({ select: () => ({ lean: async () => ({ _id: id, role, isActive, ctuIdentifier: 'CB00001', email: 'test@example.com' }) }) }));
  mock.method(employeeModel, 'findById', () => ({ lean: async () => ({ permissionIds: [permissionId] }) }));
  mock.method(permissionModel, 'find', () => ({ select: () => ({ lean: async () => permissions.map(permissionName => ({ permissionName })) }) }));
};
const check = async (role: string = 'ADMIN') => {
  let result: unknown = 'not called';
  await requirePermission('MANAGE_BOOKS')({ user: { accountId: id.toHexString(), ctuIdentifier: 'ADMIN', role } } as AuthenticatedRequest, {} as Response, ((error?: unknown) => { result = error; }) as NextFunction);
  return result;
};
test('ADMIN chưa được cấp MANAGE_BOOKS bị chặn', async () => {
  stubAccess('ADMIN');
  const error = await check();
  assert.ok(error instanceof AppError && error.statusCode === 403);
});
test('EMPLOYEE có quyền được phép thao tác', async () => {
  stubAccess('EMPLOYEE', ['MANAGE_BOOKS']);
  assert.equal(await check('EMPLOYEE'), undefined);
});
test('role mới trong DB có hiệu lực dù JWT còn role ADMIN', async () => {
  stubAccess('READER', ['MANAGE_BOOKS']);
  const error = await check();
  assert.ok(error instanceof AppError && error.statusCode === 403);
});
test('tài khoản bị khóa bị chặn ngay dù JWT chưa hết hạn', async () => {
  stubAccess('ADMIN', ['MANAGE_BOOKS'], false);
  const error = await check();
  assert.ok(error instanceof AppError && error.statusCode === 401);
});
test('danh sách quyền phản ánh thu hồi từ DB, không lấy từ JWT', async () => {
  stubAccess('EMPLOYEE', ['MANAGE_AUTHORS']);
  const access = await getAccountAccess(id.toHexString());
  assert.deepEqual(access.permissions, ['MANAGE_AUTHORS']);
  const error = await check('EMPLOYEE');
  assert.ok(error instanceof AppError && error.statusCode === 403);
});
test('chưa xác thực trả 401 trước khi truy vấn dữ liệu', async () => {
  let result: unknown;
  await requirePermission('MANAGE_BOOKS')({} as AuthenticatedRequest, {} as Response, ((error?: unknown) => { result = error; }) as NextFunction);
  assert.ok(result instanceof AppError && result.statusCode === 401);
});

// Máy chủ kiểm thử dùng model giả lập, không kết nối DB hay nạp tệp cấu hình bí mật.
process.env.ACCESS_TOKEN_SECRET_KEY = 'local-access-control-test-secret';
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRouter);
app.use('/reader', readerRouter);
app.use('/employee', employeeRouter);
app.use('/permission', permissionRouter);
app.use('/faculty', facultyRouter);
app.use('/author', authorRouter);
const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  res.status(error instanceof AppError ? error.statusCode : 500).json({ status: 'error', message: error instanceof Error ? error.message : 'Lỗi hệ thống', data: null });
};
app.use(handleError);
const server = app.listen(0, '127.0.0.1');
let base: string;
before(async () => {
  if (!server.listening) await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
const token = () => generateAccessToken({ accountId: id.toHexString(), ctuIdentifier: 'ADMIN', role: 'ADMIN' });
test('GET auth/me không có token trả 401 và không được cache', async () => {
  const response = await fetch(`${base}/api/v1/auth/me`);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('GET auth/me trả role và quyền hiện tại từ DB', async () => {
  stubAccess('EMPLOYEE', ['MANAGE_AUTHORS']);
  const response = await fetch(`${base}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token()}` } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'success');
  assert.equal(result.data.role, 'EMPLOYEE');
  assert.deepEqual(result.data.permissions, ['MANAGE_AUTHORS']);
});
test('API ghi khoa/viện và tác giả không cho phép khách bỏ qua giao diện', async () => {
  for (const path of ['/faculty', '/author']) {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401);
  }
});
test('role bị hạ từ ADMIN thành EMPLOYEE không được gọi API quản trị', async () => {
  stubAccess('EMPLOYEE', ['MANAGE_BOOKS']);
  for (const path of ['/reader', '/employee', '/permission']) {
    const response = await fetch(base + path, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(response.status, 403);
  }
});
