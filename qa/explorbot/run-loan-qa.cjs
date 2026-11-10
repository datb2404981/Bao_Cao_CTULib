const { randomBytes, randomInt } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const { join } = require('node:path');

const backendRequire = createRequire(join(__dirname, '..', '..', 'apps', 'backend', 'package.json'));
const mongoose = backendRequire('mongoose');
const bcrypt = backendRequire('bcryptjs');

const mongoUri = 'mongodb://127.0.0.1:27029/ctulib_explorbot_e2e?replicaSet=ctulibQArs';
const apiUrl = 'http://127.0.0.1:8080';
const bookId = new mongoose.Types.ObjectId('56e6630ff48c0647904890f3');
const credentialNames = [
  'CTULIB_QA_READER_ID',
  'CTULIB_QA_READER_PASSWORD',
  'CTULIB_QA_EMPLOYEE_ID',
  'CTULIB_QA_EMPLOYEE_PASSWORD',
];

const createIsolatedAccounts = async () => {
  const apiResponse = await fetch(`${apiUrl}/book?limit=12`);
  if (!apiResponse.ok) throw new Error('API QA chưa sẵn sàng');
  const apiBooks = (await apiResponse.json()).data?.items;

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  try {
    const db = mongoose.connection.db;
    const options = (await db.admin().command({ getCmdLineOpts: 1 })).parsed;
    const hello = await db.admin().command({ hello: 1 });
    if (db.databaseName !== 'ctulib_explorbot_e2e' || options.net?.port !== 27029 ||
      options.net?.bindIp !== '127.0.0.1' || !hello.isWritablePrimary) {
      throw new Error('Chỉ tạo tài khoản trong MongoDB QA cô lập');
    }

    const book = await db.collection('books').findOne({ _id: bookId }, { projection: { availableCopies: 1 } });
    if (!book || !Number.isInteger(book.availableCopies) || book.availableCopies < 1 ||
      apiBooks?.length !== 12 || !apiBooks.some(item => item.bookId === bookId.toString() && item.availableCopies === book.availableCopies)) {
      throw new Error('API chưa khớp sách và tồn kho của MongoDB QA');
    }

    const faculty = await db.collection('faculties').findOne({}, { projection: { _id: 1 } });
    const permissions = await db.collection('permissions')
      .find({ permissionName: { $in: ['MANAGE_LOANS', 'APPROVE_HANDOVER', 'PROCESS_RETURN'] } }, { projection: { _id: 1 } })
      .toArray();
    if (!faculty || permissions.length !== 3) throw new Error('Thiếu khoa hoặc quyền nhân viên QA');

    const readerId = `B9${String(randomInt(1_000_000)).padStart(6, '0')}`;
    const employeeId = `CB9${String(randomInt(10_000)).padStart(4, '0')}`;
    const readerPassword = randomBytes(24).toString('base64url');
    const employeePassword = randomBytes(24).toString('base64url');
    const readerObjectId = new mongoose.Types.ObjectId();
    const employeeObjectId = new mongoose.Types.ObjectId();
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await db.collection('acounts').insertMany([
          { _id: readerObjectId, ctuIdentifier: readerId, email: `${readerId.toLowerCase()}@qa.invalid`, password: await bcrypt.hash(readerPassword, 10), role: 'READER', isActive: true },
          { _id: employeeObjectId, ctuIdentifier: employeeId, email: `${employeeId.toLowerCase()}@qa.invalid`, password: await bcrypt.hash(employeePassword, 10), role: 'EMPLOYEE', isActive: true },
        ], { session });
        await db.collection('readers').insertOne({
          _id: readerObjectId, fullName: 'Độc giả tự động QA', readerType: 'STUDENT', facultyId: faculty._id,
          isBorrowingBlocked: false, isBorrowingManuallyBlocked: false,
          borrowingBlockReason: '', loanReservationVersion: 0,
        }, { session });
        await db.collection('employees').insertOne({
          _id: employeeObjectId, fullName: 'Thủ thư tự động QA', position: 'Thủ thư',
          permissionIds: permissions.map(permission => permission._id),
        }, { session });
      });
    } finally {
      await session.endSession();
    }

    process.stdout.write(`Đã tạo tài khoản thử nghiệm cô lập ${readerId} và ${employeeId} (không xuất mật khẩu).\n`);
    return {
      CTULIB_QA_READER_ID: readerId,
      CTULIB_QA_READER_PASSWORD: readerPassword,
      CTULIB_QA_EMPLOYEE_ID: employeeId,
      CTULIB_QA_EMPLOYEE_PASSWORD: employeePassword,
    };
  } finally {
    await mongoose.disconnect();
  }
};

const main = async () => {
  const supplied = credentialNames.filter(name => Boolean(process.env[name]));
  if (supplied.length > 0 && supplied.length !== credentialNames.length) {
    throw new Error('Phải cung cấp đủ bốn biến tài khoản QA hoặc để trống cả bốn');
  }

  const accounts = supplied.length === credentialNames.length
    ? Object.fromEntries(credentialNames.map(name => [name, process.env[name]]))
    : await createIsolatedAccounts();

  const child = spawn(process.execPath, [join(__dirname, 'loan-lifecycle-e2e.cjs')], {
    env: { ...process.env, ...accounts },
    stdio: 'inherit',
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => {
      process.exitCode = code === null ? 1 : code;
      resolve();
    });
  });
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
