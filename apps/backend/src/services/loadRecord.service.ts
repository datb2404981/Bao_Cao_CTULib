import { Types, type FilterQuery } from "mongoose";
import bookModel from "../models/book.model.js";
import loanRecordModel from "../models/loanRecord.model.js";
import readerModel from "../models/reader.model.js";
import penaltyRecordModel from "../models/penaltyRecord.model.js";
import { AppError } from "../utils/app-error.js";
import {
  LOAN_STATUSES,
  type LoadRecord,
  type LoanStatus,
} from "../models/loanRecord.model.js";

/**
 * BR_01, BR_02: Đăng ký đặt giữ chỗ sách trực tuyến
 */
export const createLoanRecord = async (input: { readerId: string; bookId: string }) => {
  if (!Types.ObjectId.isValid(input.readerId) || !Types.ObjectId.isValid(input.bookId)) {
    throw new AppError("ID độc giả hoặc sách không hợp lệ", 400);
  }

  const session = await loanRecordModel.startSession();
  try {
    return await session.withTransaction(async () => {
      // Ghi cùng document Reader để MongoDB tuần tự hoá các yêu cầu của một độc giả.
      // withTransaction sẽ retry khi hai transaction ghi xung đột.
      const reader = await readerModel.findOneAndUpdate(
        {
          _id: input.readerId,
          isBorrowingBlocked: { $ne: true },
          isBorrowingManuallyBlocked: { $ne: true },
        },
        { $inc: { loanReservationVersion: 1 } },
        { session, new: true },
      );
      if (!reader) {
        const exists = await readerModel.exists({ _id: input.readerId }).session(session);
        throw new AppError(
          exists ? "Tài khoản đang bị khoá mượn sách" : "Độc giả không tồn tại",
          exists ? 403 : 404,
        );
      }

      const book = await bookModel.findById(input.bookId).session(session).lean();
      if (!book) throw new AppError("Sách không tồn tại", 404);
      if (!book.isAvailableForCirculation)
        throw new AppError("Sách không còn lưu hành", 400);
      if (book.availableCopies <= 0)
        throw new AppError("Sách đã hết bản khả dụng trên kệ", 400);

      const now = new Date();
      const hasBlockedLoan = await loanRecordModel
        .exists({
          readerId: reader._id,
          $or: [
            { status: { $in: ["Quá hạn", "Chờ nộp phạt"] } },
            { status: "Đang mượn", dueDate: { $lt: now } },
          ],
        })
        .session(session);
      if (hasBlockedLoan) {
        throw new AppError(
          "Bạn có phiếu quá hạn hoặc chưa nộp phạt, không thể mượn sách",
          400,
        );
      }

      const activeLoanCount = await loanRecordModel
        .countDocuments({
          readerId: reader._id,
          status: { $in: ["Đặt lịch mượn", "Đang mượn"] },
        })
        .session(session);
      if (activeLoanCount >= 3) {
        throw new AppError(
          "Độc giả đã đạt hạn mức tối đa 03 quyển sách đang giữ/đặt",
          400,
        );
      }

      const duplicate = await loanRecordModel
        .exists({
          readerId: reader._id,
          bookId: book._id,
          status: { $in: ["Đặt lịch mượn", "Đang mượn"] },
        })
        .session(session);
      if (duplicate)
        throw new AppError("Độc giả đã có phiếu đặt sách này chưa hoàn tất", 400);

      const updatedBook = await bookModel.findOneAndUpdate(
        { _id: book._id, availableCopies: { $gt: 0 }, isAvailableForCirculation: true },
        { $inc: { availableCopies: -1 } },
        { session, new: true },
      );
      if (!updatedBook) throw new AppError("Sách vừa hết bản khả dụng trên kệ", 400);

      const reservationHours = updatedBook.availableCopies + 1 >= 5 ? 24 : 3;
      const [newLoan] = await loanRecordModel.create(
        [
          {
            readerId: reader._id,
            bookId: book._id,
            reservationDate: now,
            reservationExpiryDate: new Date(
              now.getTime() + reservationHours * 60 * 60 * 1000,
            ),
            status: "Đặt lịch mượn",
          },
        ],
        { session },
      );
      return newLoan;
    });
  } finally {
    await session.endSession();
  }
};

/**
 * UC15, BR_03, BR_09: Thủ thư duyệt bàn giao sách tại quầy
 */
export const approveHandoverLoanRecord = async (input: {
  loanId: string;
  employeeId: string;
}) => {
  const loanRecord = await loanRecordModel.findById(input.loanId);
  if (!loanRecord) throw new AppError("Phiếu mượn không tồn tại", 404);

  if (loanRecord.status !== "Đặt lịch mượn") {
    throw new AppError(
      `Chỉ được giao sách cho phiếu đang đặt lịch (Trạng thái hiện tại: ${loanRecord.status})`,
      400,
    );
  }

  const now = new Date();

  if (loanRecord.reservationExpiryDate <= now) {
    throw new AppError("Phiếu đã hết hạn giữ chỗ", 400);
  }

  const dueDate: Date = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);
  dueDate.setHours(23, 59, 59, 999);

  const updateRecord = await loanRecordModel.findOneAndUpdate(
    {
      _id: input.loanId,
      status: "Đặt lịch mượn",
      reservationExpiryDate: { $gt: now },
    },
    {
      $set: {
        status: "Đang mượn",
        handoverEmployeeId: new Types.ObjectId(input.employeeId),
        handoverDate: now,
        dueDate,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updateRecord) {
    throw new AppError("Phiếu đã được xử lý bởi yêu cầu khác", 409);
  }

  return updateRecord;
};

/**
 * UC10, BR_01, BR_02: Hủy phiếu đặt giữ chỗ & hoàn trả tồn kho
 */
export const cancelReservationLoanRecord = async (input: {
  loanId: string;
  cancelledByReaderId?: string;
}) => {
  if (!Types.ObjectId.isValid(input.loanId)) {
    throw new AppError("ID phiếu mượn không hợp lệ", 400);
  }

  const session = await loanRecordModel.startSession();
  try {
    return await session.withTransaction(async () => {
      const loan = await loanRecordModel.findById(input.loanId).session(session);
      if (!loan) throw new AppError("Phiếu mượn không tồn tại", 404);

      if (loan.status !== "Đặt lịch mượn") {
        throw new AppError("Chỉ có thể huỷ phiếu đang ở trạng thái 'Đặt lịch mượn'", 400);
      }

      if (
        input.cancelledByReaderId &&
        loan.readerId.toString() !== input.cancelledByReaderId
      ) {
        throw new AppError("Bạn không có quyền huỷ phiếu mượn của độc giả khác", 403);
      }

      const cancelled = await loanRecordModel.findOneAndUpdate(
        { _id: loan._id, status: "Đặt lịch mượn" },
        { $set: { status: "Đã huỷ" } },
        { session, new: true, runValidators: true },
      );
      if (!cancelled) throw new AppError("Phiếu đã được xử lý", 409);

      const restored = await bookModel.updateOne(
        { _id: loan.bookId, $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
        { $inc: { availableCopies: 1 } },
        { session },
      );
      if (restored.modifiedCount !== 1) {
        throw new AppError("Không thể hoàn kho phiếu đã huỷ", 409);
      }

      return cancelled;
    });
  } finally {
    await session.endSession();
  }
};

/**
 * UC16, BR_04, BR_05, BR_06: Tiếp nhận hoàn trả sách tại quầy
 */
export const processReturnLoanRecord = async (input: {
  loanId: string;
  employeeId: string;
  damagePercentage: number;
  returnCondition?: string;
  violationNote?: string;
}) => {
  // 1. Validate input
  if (
    !Types.ObjectId.isValid(input.loanId) ||
    !Types.ObjectId.isValid(input.employeeId)
  ) {
    throw new AppError("ID không hợp lệ", 400);
  }

  if (
    !Number.isFinite(input.damagePercentage) ||
    input.damagePercentage < 0 ||
    input.damagePercentage > 100
  ) {
    throw new AppError("Tỷ lệ hư hại phải từ 0% đến 100%", 400);
  }

  const session = await loanRecordModel.startSession();

  try {
    return await session.withTransaction(async () => {
      // 2. Kiểm tra phiếu mượn
      const loan = await loanRecordModel.findById(input.loanId).session(session);

      if (!loan) {
        throw new AppError("Phiếu mượn không tồn tại", 404);
      }

      if (!["Đang mượn", "Quá hạn"].includes(loan.status)) {
        throw new AppError("Phiếu không thể tiếp nhận trả", 409);
      }

      if (!loan.dueDate || !Number.isFinite(loan.dueDate.getTime())) {
        throw new AppError("Hạn trả sách không hợp lệ", 409);
      }

      // 3. Kiểm tra thông tin sách
      const book = await bookModel.findById(loan.bookId).session(session);

      if (!book) {
        throw new AppError("Sách không tồn tại", 404);
      }

      if (!Number.isFinite(book.coverPrice) || book.coverPrice < 0) {
        throw new AppError("Giá bìa sách không hợp lệ", 400);
      }

      // 4. Tính toán nghiệp vụ
      const actualReturnDate = new Date();

      const overdueMilliseconds = Math.max(
        0,
        actualReturnDate.getTime() - loan.dueDate.getTime(),
      );

      const overdueDays = Math.ceil(overdueMilliseconds / (24 * 60 * 60 * 1000));

      const overdueFee = overdueDays * 5000;

      const damageFee = Math.round((book.coverPrice * input.damagePercentage) / 100);

      const totalPenalty = overdueFee + damageFee;

      const hasPenalty = totalPenalty > 0;

      const isBookReusable = input.damagePercentage === 0;

      const nextStatus = hasPenalty ? "Chờ nộp phạt" : "Đã trả";

      // 5. Chuyển trạng thái phiếu có điều kiện
      const updatedLoan = await loanRecordModel.findOneAndUpdate(
        {
          _id: loan._id,
          status: { $in: ["Đang mượn", "Quá hạn"] },
        },
        {
          $set: {
            actualReturnDate,
            returnEmployeeId: new Types.ObjectId(input.employeeId),
            returnCondition:
              input.returnCondition ??
              (isBookReusable ? "Nguyên vẹn" : `Hư hại ${input.damagePercentage}%`),
            status: nextStatus,
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        },
      );

      if (!updatedLoan) {
        throw new AppError("Phiếu đã được xử lý", 409);
      }

      // 6. Hoàn kho nếu sách đủ điều kiện
      if (isBookReusable && !hasPenalty) {
        const restoredBook = await bookModel.updateOne(
          {
            _id: book._id,
            $expr: { $lt: ["$availableCopies", "$totalCopies"] },
          },
          {
            $inc: { availableCopies: 1 },
          },
          { session },
        );

        if (restoredBook.modifiedCount !== 1) {
          throw new AppError("Không thể hoàn kho sách", 409);
        }
      }

      // 7. Xử lý tiền phạt
      let penaltyRecord = null;

      if (hasPenalty) {
        const [penalty] = await penaltyRecordModel.create(
          [
            {
              loanRecordId: loan._id,
              issuedDate: actualReturnDate,
              overdueDays,
              appliedCoverPrice: book.coverPrice,
              damagePercentage: input.damagePercentage,
              overdueFee,
              damageFee,
              totalPenalty,
              ...(input.violationNote ? { violationNote: input.violationNote } : {}),
              paymentStatus: "Chờ thanh toán",
            },
          ],
          { session },
        );

        penaltyRecord = penalty;

        const updatedReader = await readerModel.updateOne(
          { _id: loan.readerId },
          { $set: { isBorrowingBlocked: true } },
          { session },
        );

        if (updatedReader.matchedCount !== 1) {
          throw new AppError("Độc giả không tồn tại", 404);
        }
      }

      return {
        loan: updatedLoan,
        penaltyRecord,
        overdueDays,
        overdueFee,
        damageFee,
        totalPenalty,
      };
    });
  } finally {
    await session.endSession();
  }
};

export const collectPenaltyPayment = async (input: {
  loanId?: string;
  penaltyId?: string;
  employeeId: string;
  expectedTotalPenalty?: number;
}) => {
  // 1. Kiểm tra dữ liệu đầu vào
  if (
    (!input.loanId && !input.penaltyId) ||
    (input.loanId !== undefined && !Types.ObjectId.isValid(input.loanId)) ||
    (input.penaltyId !== undefined && !Types.ObjectId.isValid(input.penaltyId)) ||
    !Types.ObjectId.isValid(input.employeeId)
  ) {
    throw new AppError("ID không hợp lệ", 400);
  }

  const session = await loanRecordModel.startSession();

  try {
    return await session.withTransaction(async () => {
      // Khoản tiền phải lấy từ DB, không tin số tiền do client gửi lên.
      const penalty = await penaltyRecordModel.findOne(
        input.penaltyId ? { _id: input.penaltyId } : { loanRecordId: input.loanId },
      ).session(session);

      if (!penalty) {
        throw new AppError("Không tìm thấy phiếu phạt", 404);
      }

      const loan = await loanRecordModel.findById(penalty.loanRecordId).session(session);
      if (!loan) throw new AppError("Phiếu mượn không tồn tại", 404);
      if (loan.status !== "Chờ nộp phạt") {
        throw new AppError("Phiếu mượn không ở trạng thái chờ nộp phạt", 409);
      }

      if (penalty.paymentStatus !== "Chờ thanh toán") {
        throw new AppError("Phiếu phạt đã được thanh toán", 409);
      }

      if (input.expectedTotalPenalty !== undefined &&
          input.expectedTotalPenalty !== penalty.totalPenalty) {
        throw new AppError("Tổng tiền phạt đã thay đổi, vui lòng đối chiếu lại", 409);
      }

      const paymentDate = new Date();

      // 4. Cập nhật thanh toán có điều kiện
      const updatedPenalty = await penaltyRecordModel.findOneAndUpdate(
        {
          _id: penalty._id,
          paymentStatus: "Chờ thanh toán",
        },
        {
          $set: {
            paymentStatus: "Đã thanh toán",
            paymentDate,
            paymentEmployeeId: new Types.ObjectId(input.employeeId),
            amountCollected: penalty.totalPenalty,
            paymentMethod: "CASH",
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        },
      );

      if (!updatedPenalty) {
        throw new AppError("Phiếu phạt đã được xử lý", 409);
      }

      // 5. Hoàn tất phiếu mượn
      const updatedLoan = await loanRecordModel.findOneAndUpdate(
        {
          _id: loan._id,
          status: "Chờ nộp phạt",
        },
        {
          $set: {
            status: "Đã trả",
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        },
      );

      if (!updatedLoan) {
        throw new AppError("Phiếu mượn đã được xử lý", 409);
      }

      // Tồn kho chỉ được quyết toán sau khi hoàn tất thanh toán.
      if (penalty.damagePercentage === 0) {
        const restored = await bookModel.updateOne(
          { _id: loan.bookId, $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
          { $inc: { availableCopies: 1 } },
          { session },
        );
        if (restored.modifiedCount !== 1) throw new AppError("Không thể hoàn kho sách", 409);
      } else if (penalty.damagePercentage === 100) {
        const removed = await bookModel.updateOne(
          { _id: loan.bookId, totalCopies: { $gt: 0 },
            $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
          { $inc: { totalCopies: -1 } },
          { session },
        );
        if (removed.modifiedCount !== 1) throw new AppError("Không thể ghi giảm sách mất/hư hại", 409);
      }

      // 6. Kiểm tra các phiếu còn vi phạm
      const now = new Date();

      const hasBlockingLoan = await loanRecordModel
        .exists({
          readerId: loan.readerId,
          _id: { $ne: loan._id },
          $or: [
            {
              status: {
                $in: ["Quá hạn", "Chờ nộp phạt"],
              },
            },
            {
              status: "Đang mượn",
              dueDate: { $lt: now },
            },
          ],
        })
        .session(session);

      const reader = await readerModel.findById(loan.readerId).session(session);
      if (!reader) throw new AppError("Độc giả không tồn tại", 404);
      const isBorrowingBlocked = Boolean(hasBlockingLoan || reader.isBorrowingManuallyBlocked);
      await readerModel.updateOne(
        { _id: loan.readerId },
        { $set: { isBorrowingBlocked } },
        { session },
      );

      // 8. Trả kết quả
      return {
        loan: updatedLoan,
        penalty: updatedPenalty,
        isBorrowingBlocked,
        message: "Thu tiền phạt thành công",
      };
    });
  } finally {
    await session.endSession();
  }
};

type LoanListInput = {
  page?: number;
  limit?: number;
  status?: LoanStatus;
  readerId?: string;
  bookId?: string;
  fromDate?: Date;
  toDate?: Date;
};

const getLoanPage = async (input: LoanListInput) => {
  const page = input.page ?? 1;
  const limit = input.limit ?? 10;

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new AppError("Phân trang không hợp lệ (limit tối đa 100)", 400);
  }
  if (input.status && !LOAN_STATUSES.includes(input.status)) {
    throw new AppError("Trạng thái phiếu không hợp lệ", 400);
  }
  for (const id of [input.readerId, input.bookId]) {
    if (id !== undefined && !Types.ObjectId.isValid(id)) {
      throw new AppError("ID lọc phiếu mượn không hợp lệ", 400);
    }
  }
  if (
    (input.fromDate && !Number.isFinite(input.fromDate.getTime())) ||
    (input.toDate && !Number.isFinite(input.toDate.getTime())) ||
    (input.fromDate && input.toDate && input.fromDate > input.toDate)
  ) {
    throw new AppError("Khoảng ngày không hợp lệ", 400);
  }

  const filter: FilterQuery<LoadRecord> = {};
  if (input.status) filter.status = input.status;
  if (input.readerId) filter.readerId = new Types.ObjectId(input.readerId);
  if (input.bookId) filter.bookId = new Types.ObjectId(input.bookId);
  if (input.fromDate || input.toDate) {
    filter.reservationDate = {
      ...(input.fromDate ? { $gte: input.fromDate } : {}),
      ...(input.toDate ? { $lte: input.toDate } : {}),
    };
  }

  const [records, total] = await Promise.all([
    loanRecordModel
      .find(filter)
      .sort({ reservationDate: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    loanRecordModel.countDocuments(filter),
  ]);

  return {
    records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/** Danh sách phiếu cho thủ thư, có phân trang và lọc. */
export const getAllLoanRecords = async (input: LoanListInput = {}) => {
  await syncExpiredLoanRecords();

  return getLoanPage(input);
};

/** Lịch sử mượn của một độc giả; controller phải lấy readerId từ JWT khi tự xem. */
export const getReaderLoanHistory = async (
  input: Omit<LoanListInput, "readerId"> & { readerId: string },
) => {
  if (!Types.ObjectId.isValid(input.readerId)) {
    throw new AppError("Mã độc giả không hợp lệ", 400);
  }

  await syncExpiredLoanRecords();
  return getLoanPage(input);
};

/** Hủy phiếu giữ chỗ đã hết hạn, hoàn đúng một bản sách cho mỗi phiếu. */
export const expireReservations = async (now = new Date()) => {
  if (!Number.isFinite(now.getTime())) throw new AppError("Thời điểm không hợp lệ", 400);

  const expired = await loanRecordModel
    .find({
      status: "Đặt lịch mượn",
      reservationExpiryDate: { $lte: now },
    })
    .select("_id")
    .lean();

  let expiredCount = 0;
  for (const candidate of expired) {
    const session = await loanRecordModel.startSession();
    try {
      const cancelled = await session.withTransaction(async () => {
        const loan = await loanRecordModel.findOneAndUpdate(
          {
            _id: candidate._id,
            status: "Đặt lịch mượn",
            reservationExpiryDate: { $lte: now },
          },
          { $set: { status: "Đã huỷ" } },
          { session, new: true, runValidators: true },
        );
        if (!loan) return false;

        const restored = await bookModel.updateOne(
          { _id: loan.bookId, $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
          { $inc: { availableCopies: 1 } },
          { session },
        );
        if (restored.modifiedCount !== 1) {
          throw new AppError("Không thể hoàn kho phiếu hết hạn", 409);
        }
        return true;
      });
      if (cancelled) expiredCount++;
    } finally {
      await session.endSession();
    }
  }
  return { expiredCount };
};

/** Đánh dấu các phiếu đang mượn quá hạn; chạy lặp an toàn. */
export const markOverdueLoans = async (now = new Date()) => {
  if (!Number.isFinite(now.getTime())) throw new AppError("Thời điểm không hợp lệ", 400);

  const overdueFilter = {
    status: "Đang mượn" as const,
    dueDate: { $lt: now },
  };
  const result = await loanRecordModel.updateMany(overdueFilter, {
    $set: { status: "Quá hạn" },
  });

  // Đọc sau khi chuyển trạng thái để lần chạy sau có thể khôi phục
  // việc khóa độc giả nếu lần chạy trước bị gián đoạn.
  const readerIds = await loanRecordModel.distinct("readerId", {
    $or: [{ status: "Quá hạn" }, { status: "Đang mượn", dueDate: { $lt: now } }],
  });
  if (readerIds.length > 0) {
    await readerModel.updateMany(
      { _id: { $in: readerIds } },
      { $set: { isBorrowingBlocked: true } },
    );
  }
  return { markedCount: result.modifiedCount };
};

/**
 * Dùng chung hai hàm idempotent để tránh hoàn kho hai lần khi cron chạy song song.
 */
export const syncExpiredLoanRecords = async () => {
  const now = new Date();
  const reservations = await expireReservations(now);
  const overdue = await markOverdueLoans(now);
  return { ...reservations, ...overdue };
};

export const archiveLoanRecord = async (loanId: string) => {
  const loan = await loanRecordModel.findById(loanId);

  if (!loan)
    throw new AppError("Phiếu mượn không tồn tại",404);

  return await loanRecordModel.findByIdAndUpdate(
    loanId,
    { isArchived: true },
    {new: true}
  )
};
