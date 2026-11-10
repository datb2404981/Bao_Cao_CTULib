import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import mongoose, { Types } from "mongoose";
import {
  createLoanRecord,
  approveHandoverLoanRecord,
  processReturnLoanRecord,
  collectPenaltyPayment,
} from "../src/services/loadRecord.service.js";
import bookModel from "../src/models/book.model.js";
import readerModel from "../src/models/reader.model.js";
import loanRecordModel from "../src/models/loanRecord.model.js";
import penaltyRecordModel from "../src/models/penaltyRecord.model.js";
import { stopLoanExpiryScheduler } from "../src/schedulers/loan-expiry.scheduler.js";

describe("Loan Record Lifecycle & Concurrency Tests", () => {
  let readerId: string;
  let bookId: string;
  let employeeId: string;

  beforeAll(async () => {
    const uri = process.env.CTULIB_TEST_MONGODB_URI;
    if (!uri) throw new Error("Cần CTULIB_TEST_MONGODB_URI để chạy test.");
    const parsed = new URL(uri);
    if (
      !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
      !parsed.pathname.startsWith("/ctulib_qa_") ||
      !parsed.searchParams.has("replicaSet")
    ) {
      throw new Error("Test chỉ được chạy trên MongoDB replica set loopback ctulib_qa_*.");
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  });

  afterAll(async () => {
    stopLoanExpiryScheduler();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Tạo reader mẫu thỏa mãn schema (cần _id và facultyId)
    const newReaderId = new Types.ObjectId();
    const reader = await readerModel.create({
      _id: newReaderId,
      fullName: "Độc giả Test QA",
      phoneNumber: "0912345678",
      readerType: "STUDENT",
      facultyId: new Types.ObjectId(),
      isBorrowingBlocked: false,
    });
    readerId = reader._id.toString();

    // Tạo sách mẫu (5 bản)
    const book = await bookModel.create({
      title: "Lập trình Web nâng cao - Test Suite",
      bookType: "TEXTBOOK",
      coverPrice: 100000,
      totalCopies: 5,
      availableCopies: 5,
      isAvailableForCirculation: true,
      facultyId: new Types.ObjectId(),
      authorIds: [new Types.ObjectId()],
    });
    bookId = book._id.toString();

    employeeId = new Types.ObjectId().toString();
  });

  afterEach(async () => {
    // Dọn dẹp dữ liệu kiểm thử
    if (readerId) {
      const ownLoans = await loanRecordModel.find({ readerId: new Types.ObjectId(readerId) }).select("_id").lean();
      await penaltyRecordModel.deleteMany({ loanRecordId: { $in: ownLoans.map(loan => loan._id) } });
      await loanRecordModel.deleteMany({ readerId: new Types.ObjectId(readerId) });
      await readerModel.findByIdAndDelete(readerId);
    }
    if (bookId) {
      await bookModel.findByIdAndDelete(bookId);
    }
  });

  it("Chặn vượt hạn mức khi mượn đồng thời (Concurrency Test)", async () => {
    // Gửi cùng lúc 4 yêu cầu mượn
    const requests = [
      createLoanRecord({ readerId, bookId }),
      createLoanRecord({ readerId, bookId }),
      createLoanRecord({ readerId, bookId }),
      createLoanRecord({ readerId, bookId }),
    ];

    const results = await Promise.allSettled(requests);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Cùng một đầu sách chỉ được có một phiếu đang hoạt động của độc giả.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(3);
  });

  it("Quy trình Trả sách có hư hại & Thu phạt mở khóa tài khoản", async () => {
    // 1. Tạo phiếu đặt mượn
    const loan = await createLoanRecord({ readerId, bookId });
    expect(loan.status).toBe("Đặt lịch mượn");

    // 2. Duyệt giao sách tại quầy
    const handoverLoan = await approveHandoverLoanRecord({
      loanId: loan._id.toString(),
      employeeId,
    });
    expect(handoverLoan.status).toBe("Đang mượn");

    // 3. Trả sách với hư hại 20%
    const returnResult = await processReturnLoanRecord({
      loanId: loan._id.toString(),
      employeeId,
      damagePercentage: 20,
    });

    expect(returnResult.totalPenalty).toBe(20000); // 20% của 100.000 VNĐ
    expect(returnResult.loan.status).toBe("Chờ nộp phạt");

    // Kiểm tra độc giả bị tạm khóa quyền mượn (BR_06)
    const blockedReader = await readerModel.findById(readerId);
    expect(blockedReader?.isBorrowingBlocked).toBe(true);

    // 4. Thu tiền phạt tại quầy
    await collectPenaltyPayment({
      loanId: loan._id.toString(),
      employeeId,
    });

    // Kiểm tra độc giả được tự động mở khóa quyền mượn (BR_06)
    const unblockedReader = await readerModel.findById(readerId);
    expect(unblockedReader?.isBorrowingBlocked).toBe(false);
  });
});
