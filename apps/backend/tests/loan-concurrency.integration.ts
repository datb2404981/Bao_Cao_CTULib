import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { Types } from "mongoose";
import bookModel from "../src/models/book.model.js";
import loanRecordModel from "../src/models/loanRecord.model.js";
import penaltyRecordModel from "../src/models/penaltyRecord.model.js";
import readerModel from "../src/models/reader.model.js";
import { getPenalties } from "../src/services/penalty.service.js";
import {
  createLoanRecord,
  approveHandoverLoanRecord,
  cancelReservationLoanRecord,
  processReturnLoanRecord,
  collectPenaltyPayment,
  expireReservations,
  markOverdueLoans,
} from "../src/services/loadRecord.service.js";
import { AppError } from "../src/utils/app-error.js";

const uri = process.env.CTULIB_TEST_MONGODB_URI;
if (!uri) throw new Error("Cần CTULIB_TEST_MONGODB_URI cho integration test.");
const parsedUri = new URL(uri);
if (!["127.0.0.1", "localhost"].includes(parsedUri.hostname) ||
    !parsedUri.pathname.startsWith("/ctulib_qa_") ||
    !parsedUri.searchParams.has("replicaSet")) {
  throw new Error("Chỉ cho phép MongoDB replica set trên loopback và database ctulib_qa_*.");
}

const createdReaderIds: Types.ObjectId[] = [];
const createdBookIds: Types.ObjectId[] = [];

before(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([
    bookModel.init(), readerModel.init(), loanRecordModel.init(),
  ]);
});

after(async () => {
  try {
    if (mongoose.connection.readyState === 1 && createdReaderIds.length) {
      const ownLoans = await loanRecordModel
        .find({ readerId: { $in: createdReaderIds } })
        .select("_id")
        .lean();
      await penaltyRecordModel.deleteMany({ loanRecordId: { $in: ownLoans.map(loan => loan._id) } });
      await loanRecordModel.deleteMany({ readerId: { $in: createdReaderIds } });
      await readerModel.deleteMany({ _id: { $in: createdReaderIds } });
      await bookModel.deleteMany({ _id: { $in: createdBookIds } });
    }
  } finally {
    await mongoose.disconnect();
  }
});

const createReader = async () => {
  const reader = await readerModel.create({
    _id: new Types.ObjectId(),
    facultyId: new Types.ObjectId(),
    isBorrowingBlocked: false,
  });
  createdReaderIds.push(reader._id);
  return reader;
};

const createBook = async (name: string, availableCopies = 1) => {
  const book = await bookModel.create({
    title: name,
    bookType: "TEXTBOOK",
    facultyId: new Types.ObjectId(),
    authorIds: [],
    coverPrice: 100000,
    totalCopies: availableCopies,
    availableCopies,
    isAvailableForCirculation: true,
  });
  createdBookIds.push(book._id);
  return book;
};

test("năm request đồng thời cho năm sách chỉ tạo ba phiếu, tồn kho luôn hợp lệ", async () => {
  const reader = await createReader();
  const books = await Promise.all(Array.from({ length: 5 }, (_, i) => createBook(`Đồng thời ${i}`)));

  const results = await Promise.allSettled(books.map(book =>
    createLoanRecord({ readerId: reader.id, bookId: book.id }),
  ));
  const successful = results.filter(result => result.status === "fulfilled");
  const failed = results.filter(result => result.status === "rejected");
  assert.equal(successful.length, 3);
  assert.equal(failed.length, 2);
  for (const result of failed) {
    if (result.status !== "rejected") continue;
    assert.ok(result.reason instanceof AppError);
    assert.equal(result.reason.statusCode, 400);
  }

  assert.equal(await loanRecordModel.countDocuments({ readerId: reader.id, status: "Đặt lịch mượn" }), 3);
  const remaining = await bookModel.find({ _id: { $in: books.map(book => book._id) } }).lean();
  assert.equal(remaining.reduce((sum, book) => sum + book.availableCopies, 0), 2);
  assert.ok(remaining.every(book => book.availableCopies >= 0));
  assert.equal((await readerModel.findById(reader.id).lean())?.loanReservationVersion, 3);
});

test("hai request cùng sách không đặt trùng và không trừ kho hai lần", async () => {
  const reader = await createReader();
  const book = await createBook("Không đặt trùng", 2);
  const results = await Promise.allSettled([
    createLoanRecord({ readerId: reader.id, bookId: book.id }),
    createLoanRecord({ readerId: reader.id, bookId: book.id }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);
});

test("RESERVE-006: khóa thủ công vẫn chặn đặt sách khi cờ khóa tổng hợp chưa đồng bộ", async () => {
  const reader = await createReader();
  const book = await createBook("Độc giả đang bị khóa thủ công", 1);
  await readerModel.updateOne(
    { _id: reader._id },
    { $set: { isBorrowingManuallyBlocked: true, isBorrowingBlocked: false } },
  );

  await assert.rejects(
    createLoanRecord({ readerId: reader.id, bookId: book.id }),
    (error: unknown) => error instanceof AppError && error.statusCode === 403,
  );
  assert.equal(await loanRecordModel.countDocuments({ readerId: reader._id }), 0);
  assert.equal((await bookModel.findById(book._id).lean())?.availableCopies, 1);
});

test("RESERVE-018: hai độc giả tranh bản cuối chỉ tạo một phiếu", async () => {
  const [firstReader, secondReader] = await Promise.all([createReader(), createReader()]);
  const book = await createBook("Bản cuối tranh chấp", 1);
  const results = await Promise.allSettled([
    createLoanRecord({ readerId: firstReader.id, bookId: book.id }),
    createLoanRecord({ readerId: secondReader.id, bookId: book.id }),
  ]);

  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.filter(result => result.status === "rejected");
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.reason instanceof AppError);
  assert.equal(rejected[0].reason.statusCode, 400);
  assert.equal(await loanRecordModel.countDocuments({ bookId: book.id }), 1);
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 0);
});

test("RESERVE-020: hai yêu cầu tranh suất thứ ba chỉ thêm một phiếu", async () => {
  const reader = await createReader();
  const existing = await Promise.all([createBook("Đang giữ A"), createBook("Đang giữ B")]);
  await Promise.all(existing.map(book => createLoanRecord({ readerId: reader.id, bookId: book.id })));
  const next = await Promise.all([createBook("Tranh suất C"), createBook("Tranh suất D")]);
  const results = await Promise.allSettled(next.map(book =>
    createLoanRecord({ readerId: reader.id, bookId: book.id }),
  ));

  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.filter(result => result.status === "rejected");
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.reason instanceof AppError);
  assert.equal(rejected[0].reason.statusCode, 400);
  assert.equal(await loanRecordModel.countDocuments({ readerId: reader.id, status: "Đặt lịch mượn" }), 3);
  const stock = await bookModel.find({ _id: { $in: next.map(book => book._id) } }).lean();
  assert.equal(stock.reduce((sum, book) => sum + book.availableCopies, 0), 1);
});

test("hai request cùng hủy một phiếu chỉ hoàn kho một lần", async () => {
  const reader = await createReader();
  const book = await createBook("Hai yêu cầu hủy cùng lúc");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });

  const results = await Promise.allSettled([
    cancelReservationLoanRecord({ loanId: loan.id, cancelledByReaderId: reader.id }),
    cancelReservationLoanRecord({ loanId: loan.id, cancelledByReaderId: reader.id }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const failures = results.filter(result => result.status === "rejected");
  assert.equal(failures.length, 1);
  assert.ok(failures[0]?.reason instanceof AppError);
  assert.ok([400, 409].includes(failures[0].reason.statusCode));
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);
  assert.equal((await loanRecordModel.findById(loan.id).lean())?.status, "Đã huỷ");
});

test("hủy và bàn giao đồng thời chỉ có một kết quả, tồn kho khớp trạng thái", async () => {
  const reader = await createReader();
  const book = await createBook("Hủy tranh chấp bàn giao");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });

  const results = await Promise.allSettled([
    cancelReservationLoanRecord({ loanId: loan.id, cancelledByReaderId: reader.id }),
    approveHandoverLoanRecord({ loanId: loan.id, employeeId: new Types.ObjectId().toHexString() }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.filter(result => result.status === "rejected");
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.reason instanceof AppError);
  assert.ok([400, 409].includes(rejected[0].reason.statusCode));

  const saved = await loanRecordModel.findById(loan.id).lean();
  const stock = (await bookModel.findById(book.id).lean())?.availableCopies;
  assert.ok(saved?.status === "Đã huỷ" || saved?.status === "Đang mượn");
  assert.equal(stock, saved.status === "Đã huỷ" ? 1 : 0);
});

test("hai request tiếp nhận trả cùng phiếu chỉ hoàn kho một lần", async () => {
  const reader = await createReader();
  const book = await createBook("Hai yêu cầu trả cùng lúc");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });
  await loanRecordModel.updateOne({ _id: loan._id }, {
    $set: { status: "Đang mượn", dueDate: new Date(Date.now() + 86400000) },
  });

  const input = { loanId: loan.id, employeeId: new Types.ObjectId().toHexString(), damagePercentage: 0 };
  const results = await Promise.allSettled([
    processReturnLoanRecord(input),
    processReturnLoanRecord(input),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const failures = results.filter(result => result.status === "rejected");
  assert.equal(failures.length, 1);
  assert.ok(failures[0]?.reason instanceof AppError);
  assert.equal(failures[0].reason.statusCode, 409);
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);
  assert.equal((await loanRecordModel.findById(loan.id).lean())?.status, "Đã trả");
  assert.equal(await penaltyRecordModel.countDocuments({ loanRecordId: loan._id }), 0);
});

test("hai nhân viên nhận cùng phiếu quá hạn chỉ lập một phạt", async () => {
  const reader = await createReader();
  const book = await createBook("Hai nhân viên nhận sách quá hạn");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });
  await loanRecordModel.updateOne({ _id: loan._id }, {
    $set: { status: "Quá hạn", dueDate: new Date(Date.now() - 86400000) },
  });

  const results = await Promise.allSettled(Array.from({ length: 2 }, () =>
    processReturnLoanRecord({
      loanId: loan.id, employeeId: new Types.ObjectId().toHexString(), damagePercentage: 0,
    }),
  ));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.filter(result => result.status === "rejected");
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]?.reason instanceof AppError);
  assert.equal(rejected[0].reason.statusCode, 409);
  assert.equal(await penaltyRecordModel.countDocuments({ loanRecordId: loan._id }), 1);
  assert.equal((await loanRecordModel.findById(loan.id).lean())?.status, "Chờ nộp phạt");
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 0);
});

test("phiếu đang mượn quá hạn chặn đặt sách dù chưa cập nhật status", async () => {
  const reader = await createReader();
  const book = await createBook("Sách mới");
  const oldBook = await createBook("Sách cũ");
  await loanRecordModel.create({
    readerId: reader.id,
    bookId: oldBook.id,
    reservationDate: new Date(Date.now() - 10 * 86400000),
    reservationExpiryDate: new Date(Date.now() - 9 * 86400000),
    status: "Đang mượn",
    dueDate: new Date(Date.now() - 86400000),
  });
  await assert.rejects(
    createLoanRecord({ readerId: reader.id, bookId: book.id }),
    (error: unknown) => error instanceof AppError && error.statusCode === 400,
  );
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);
});

test("trả sách quá hạn, thu tiền phạt và mở khóa khi đã hết vi phạm", async () => {
  const reader = await createReader();
  const book = await createBook("Trả sách có phạt");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });
  await loanRecordModel.updateOne({ _id: loan._id }, {
    $set: {
      status: "Đang mượn",
      dueDate: new Date(Date.now() - 86400000),
    },
  });
  const employeeId = new Types.ObjectId().toHexString();
  const returned = await processReturnLoanRecord({
    loanId: loan.id,
    employeeId,
    damagePercentage: 0,
  });
  assert.equal(returned.loan.status, "Chờ nộp phạt");
  assert.ok(returned.overdueFee > 0);
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 0);
  assert.equal((await readerModel.findById(reader.id).lean())?.isBorrowingBlocked, true);

  const payment = await collectPenaltyPayment({ loanId: loan.id, employeeId });
  assert.equal(payment.loan.status, "Đã trả");
  assert.equal(payment.penalty.paymentStatus, "Đã thanh toán");
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);
  assert.equal((await readerModel.findById(reader.id).lean())?.isBorrowingBlocked, false);
});

test("hai request thu phạt cùng phiếu chỉ thanh toán một lần", async () => {
  const reader = await createReader();
  const book = await createBook("Hai yêu cầu thu phạt cùng lúc");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });
  await loanRecordModel.updateOne({ _id: loan._id }, {
    $set: { status: "Đang mượn", dueDate: new Date(Date.now() + 86400000) },
  });

  const employeeId = new Types.ObjectId().toHexString();
  await processReturnLoanRecord({ loanId: loan.id, employeeId, damagePercentage: 10 });
  const results = await Promise.allSettled([
    collectPenaltyPayment({ loanId: loan.id, employeeId }),
    collectPenaltyPayment({ loanId: loan.id, employeeId }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const failures = results.filter(result => result.status === "rejected");
  assert.equal(failures.length, 1);
  assert.ok(failures[0]?.reason instanceof AppError);
  assert.equal(failures[0].reason.statusCode, 409);
  assert.equal((await loanRecordModel.findById(loan.id).lean())?.status, "Đã trả");
  assert.equal((await penaltyRecordModel.findOne({ loanRecordId: loan._id }).lean())?.paymentStatus, "Đã thanh toán");
  assert.equal((await readerModel.findById(reader.id).lean())?.isBorrowingBlocked, false);
});

test("COLLECT-027: mất phản hồi sau khi thu phạt, đối chiếu DB rồi gửi lại không thu hai lần", async () => {
  const reader = await createReader();
  const book = await createBook("Mất phản hồi khi thu phạt");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });
  await loanRecordModel.updateOne(
    { _id: loan._id },
    { $set: { status: "Đang mượn", dueDate: new Date(Date.now() - 86400000) } },
  );

  const employeeId = new Types.ObjectId().toHexString();
  const returned = await processReturnLoanRecord({
    loanId: loan.id, employeeId, damagePercentage: 0,
  });
  assert.equal(returned.loan.status, "Chờ nộp phạt");
  assert.ok(returned.totalPenalty > 0);
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 0);

  // Mô phỏng server đã commit nhưng client không nhận được response.
  await collectPenaltyPayment({ loanId: loan.id, employeeId, expectedTotalPenalty: returned.totalPenalty });

  const penalty = await penaltyRecordModel.findOne({ loanRecordId: loan._id }).lean();
  assert.equal(penalty?.paymentStatus, "Đã thanh toán");
  assert.equal(penalty?.amountCollected, returned.totalPenalty);
  assert.ok(penalty?.paymentDate);
  assert.equal((await loanRecordModel.findById(loan.id).lean())?.status, "Đã trả");
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);

  // Client gửi lại request: API trả 409, vẫn giữ nguyên một giao dịch thanh toán.
  await assert.rejects(
    collectPenaltyPayment({ loanId: loan.id, employeeId, expectedTotalPenalty: returned.totalPenalty }),
    (error: unknown) => error instanceof AppError && error.statusCode === 409,
  );
  const afterRetry = await penaltyRecordModel.find({ loanRecordId: loan._id }).lean();
  assert.equal(afterRetry.length, 1);
  assert.equal(afterRetry[0]?.paymentStatus, "Đã thanh toán");
  assert.equal(afterRetry[0]?.amountCollected, returned.totalPenalty);
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);
});

test("hai tác vụ hết hạn chạy song song chỉ hoàn kho một lần", async () => {
  const reader = await createReader();
  const book = await createBook("Giữ chỗ đã hết hạn");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });
  await loanRecordModel.updateOne(
    { _id: loan._id },
    { $set: { reservationExpiryDate: new Date(Date.now() - 3600000) } },
  );

  const results = await Promise.all([expireReservations(), expireReservations()]);
  assert.equal(results.reduce((total, result) => total + result.expiredCount, 0), 1);
  assert.equal((await loanRecordModel.findById(loan.id).lean())?.status, "Đã huỷ");
  assert.equal((await bookModel.findById(book.id).lean())?.availableCopies, 1);
  assert.equal((await expireReservations()).expiredCount, 0);
});

test("đánh dấu quá hạn lặp lại không cộng dồn và khóa độc giả", async () => {
  const reader = await createReader();
  const book = await createBook("Quá hạn cần khóa");
  const loan = await createLoanRecord({ readerId: reader.id, bookId: book.id });
  await loanRecordModel.updateOne(
    { _id: loan._id },
    { $set: { status: "Đang mượn", dueDate: new Date(Date.now() - 86400000) } },
  );

  const eligibleCount = await loanRecordModel.countDocuments({
    status: "Đang mượn",
    dueDate: { $lt: new Date() },
  });
  const results = await Promise.all([markOverdueLoans(), markOverdueLoans()]);
  assert.ok(eligibleCount >= 1);
  assert.equal(results.reduce((total, result) => total + result.markedCount, 0), eligibleCount);
  assert.equal((await loanRecordModel.findById(loan.id).lean())?.status, "Quá hạn");
  assert.equal((await readerModel.findById(reader.id).lean())?.isBorrowingBlocked, true);
  assert.equal((await markOverdueLoans()).markedCount, 0);
});

test("thu phạt không mở khóa nếu còn phiếu đang mượn quá dueDate", async () => {
  const reader = await createReader();
  const [overdueBook, damagedBook] = await Promise.all([
    createBook("Sách chưa trả đã quá hạn"),
    createBook("Sách trả có hư hại"),
  ]);
  const overdueLoan = await createLoanRecord({ readerId: reader.id, bookId: overdueBook.id });
  const damagedLoan = await createLoanRecord({ readerId: reader.id, bookId: damagedBook.id });
  await loanRecordModel.updateOne(
    { _id: overdueLoan._id },
    { $set: { status: "Đang mượn", dueDate: new Date(Date.now() - 86400000) } },
  );
  await loanRecordModel.updateOne(
    { _id: damagedLoan._id },
    { $set: { status: "Đang mượn", dueDate: new Date(Date.now() + 86400000) } },
  );

  const employeeId = new Types.ObjectId().toHexString();
  const returned = await processReturnLoanRecord({
    loanId: damagedLoan.id,
    employeeId,
    damagePercentage: 10,
  });
  assert.equal(returned.loan.status, "Chờ nộp phạt");

  const payment = await collectPenaltyPayment({ loanId: damagedLoan.id, employeeId });
  assert.equal(payment.loan.status, "Đã trả");
  assert.equal(payment.isBorrowingBlocked, true);
  assert.equal((await readerModel.findById(reader.id).lean())?.isBorrowingBlocked, true);
});

test("PENALTY-LIST-007: issuedDate trùng nhau phân trang ổn định theo penaltyId", async () => {
  const reader = await createReader();
  const issuedDate = new Date("2026-11-01T00:00:00.000Z");
  const books = await Promise.all(Array.from({ length: 3 }, (_, i) => createBook(`Sort penalty ${i}`)));
  const loans = await Promise.all(books.map(book => createLoanRecord({ readerId: reader.id, bookId: book.id })));
  const penalties = await Promise.all(loans.map(loan => penaltyRecordModel.create({
    loanRecordId: loan._id,
    issuedDate,
    appliedCoverPrice: 100000,
    totalPenalty: 5000,
    overdueFee: 5000,
    paymentStatus: "Chờ thanh toán",
  })));
  const first = await getPenalties({ page: 1, limit: 2, readerAccountId: reader.id });
  const second = await getPenalties({ page: 2, limit: 2, readerAccountId: reader.id });
  const actual = [...first.items, ...second.items].map(penalty => penalty.penaltyId);
  const expected = penalties.map(penalty => penalty.id).sort();

  assert.equal(first.meta.totalItems, 3);
  assert.equal(second.meta.totalItems, 3);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, 3);
});
