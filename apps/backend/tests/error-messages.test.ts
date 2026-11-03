import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import type { Request, Response } from 'express';
import { notFound, errorHandler } from '../src/middlewares/error.middleware.js';
import { AppError } from '../src/utils/app-error.js';
import { logger } from '../src/config/logger.js';

mock.method(logger, 'error', () => logger);
after(() => mock.restoreAll());
function response() {
  const result = { statusCode: 0, body: undefined as unknown };
  const res = { headersSent: false,
    status(code: number) { result.statusCode = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  };
  return { result, res: res as unknown as Response };
}
test('Đường dẫn không tồn tại trả thông báo tiếng Việt', () => {
  const { result, res } = response();
  notFound({} as Request, res, () => {});
  assert.equal(result.statusCode, 404);
  assert.deepEqual(result.body, { status: 'error', message: 'Không tìm thấy đường dẫn yêu cầu.', data: null });
});
test('Lỗi hệ thống trả tiếng Việt thay vì thông báo nội bộ tiếng Anh', () => {
  const { result, res } = response();
  errorHandler(new Error('Database connection failed'), {} as Request, res, () => {});
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { status: 'error', message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.', data: null });
});
test('Giữ nguyên mã HTTP và thông báo nghiệp vụ đã viết tiếng Việt', () => {
  const { result, res } = response();
  errorHandler(new AppError('Email đã được sử dụng', 409), {} as Request, res, () => {});
  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.body, { status: 'error', message: 'Email đã được sử dụng', data: null });
});
test('Phản hồi đã gửi thì chuyển lỗi cho middleware kế tiếp', () => {
  const { result, res } = response(); res.headersSent = true;
  const error = new Error('Already sent'); let forwarded: unknown;
  errorHandler(error, {} as Request, res, (err) => { forwarded = err; });
  assert.equal(forwarded, error); assert.equal(result.body, undefined);
});
