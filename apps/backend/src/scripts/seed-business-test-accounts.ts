import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AccountModel } from '../models/user.model.js';
import { registerSchema } from '../schemas/auth.schema.js';

// Only create missing QA accounts; no deletes, password resets, or permission grants.
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('QA: production bị chặn.');
  const fixturePath = process.argv.find((arg) => arg.startsWith('--fixtures='))?.slice(11);
  const outputPath = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
  if (!fixturePath || !outputPath) throw new Error('QA: cần --fixtures và --output.');
  const records = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const allowed = ['B9900001', 'B9900002', 'B9900102', 'B9900103', 'B9900104', 'B9900105', 'B9900106', 'B9900107', 'CB99101', 'CB99102', 'CB99103', 'CB99104', 'CB99105', 'ADMIN99101'];
  if (!Array.isArray(records) || records.length !== allowed.length ||
      new Set(records.map((f) => f.ctuIdentifier)).size !== allowed.length) {
    throw new Error('QA: danh sách fixture không hợp lệ.');
  }
  for (const f of records) {
    registerSchema.parse({ ctuIdentifier: f.ctuIdentifier, email: f.email, password: f.password });
    if (!allowed.includes(f.ctuIdentifier) || !f.email.endsWith('@example.com') ||
        !['READER', 'EMPLOYEE', 'ADMIN'].includes(f.role) || typeof f.isActive !== 'boolean') {
      throw new Error('QA: fixture ngoài phạm vi cho phép.');
    }
  }
  const anchor = records.find((f) => f.ctuIdentifier === 'B9900001');
  const login = await fetch('http://localhost:8080/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ctuIdentifier: anchor.ctuIdentifier, password: anchor.password }),
    signal: AbortSignal.timeout(10000),
  });
  const loginBody = await login.json();
  if (login.status !== 200) throw new Error('QA: reader mốc chưa đăng nhập được.');
  if (!process.env.MONGODB_URI) throw new Error('QA: thiếu cấu hình database.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const dbAnchor = await AccountModel.findOne({ ctuIdentifier: anchor.ctuIdentifier });
  if (!dbAnchor || dbAnchor.id !== loginBody.data?.user?.accountId) {
    throw new Error('QA: database không khớp server test localhost.');
  }
  // Check every conflict before creating the first record.
  const missing = [];
  for (const f of records) {
    const found = await AccountModel.findOne({ $or: [{ ctuIdentifier: f.ctuIdentifier }, { email: f.email }] }).select('+password');
    if (!found) { missing.push(f); continue; }
    if (found.ctuIdentifier !== f.ctuIdentifier || found.email !== f.email || found.role !== f.role ||
        found.isActive !== f.isActive || !(await bcrypt.compare(f.password, found.password))) {
      throw new Error(`QA: fixture ${f.alias} xung đột; không ghi đè.`);
    }
  }
  if (!process.argv.includes('--apply') && missing.length) {
    throw new Error(`QA: còn ${missing.length} tài khoản chưa seed; kiểm tra xong rồi dùng --apply.`);
  }
  for (const f of missing) {
    await AccountModel.create({ ctuIdentifier: f.ctuIdentifier, email: f.email,
      password: await bcrypt.hash(f.password, 10), role: f.role, isActive: f.isActive });
  }
  const result = [];
  for (const f of records) {
    const response = await fetch('http://localhost:8080/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ctuIdentifier: f.ctuIdentifier, password: f.password }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    const account = await AccountModel.findOne({ ctuIdentifier: f.ctuIdentifier });
    if (!account || response.status !== (f.isActive ? 200 : 403) ||
        (f.isActive && (body.data?.user?.accountId !== account.id || body.data?.user?.role !== f.role))) {
      throw new Error(`QA: HTTP fixture ${f.alias} không đạt.`);
    }
    result.push({ alias: f.alias, accountId: account.id, ctuIdentifier: f.ctuIdentifier,
      role: f.role, isActive: f.isActive, accountPreparationStatus: 'VERIFIED',
      businessStatePreparationStatus: 'PENDING_BACKEND_MODELS' });
  }
  writeFileSync(outputPath, JSON.stringify({ verifiedAt: new Date().toISOString(), server: 'http://localhost:8080', accounts: result }, null, 2));
  console.log(`QA: ${missing.length} tài khoản mới; ${result.length} tài khoản đã xác minh HTTP. Chưa seed quyền/sách/phiếu/phạt.`);
}

try { await main(); } catch (error) {
  const message = error instanceof Error ? error.message : '';
  console.error(message.startsWith('QA:') ? message : 'QA: chuẩn bị dữ liệu thất bại; không in cấu hình hoặc response chứa token.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
