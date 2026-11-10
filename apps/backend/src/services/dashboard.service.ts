import bookModel from "../models/book.model.js";
import loanRecordModel from "../models/loanRecord.model.js";
import penaltyRecordModel from "../models/penaltyRecord.model.js";
import readerModel from "../models/reader.model.js";
import { syncExpiredLoanRecords } from "./loadRecord.service.js";

/**
 * UC19, SC11: Thống kê chỉ số vận hành và cảnh báo kho / quá hạn cho Dashboard
 */
export const getDashboardStatistics = async () => {
  await syncExpiredLoanRecords();

  const [
    bookStats,
    outOfStockCount,
    outOfStockBooks,
    activeReadersCount,
    borrowingCount,
    overdueCount,
    pendingPenaltyCount,
    penaltyAgg,
  ] = await Promise.all([
    // 1. Thống kê tổng số đầu sách và số bản in đang lưu hành
    bookModel.aggregate<{
      totalTitles: number;
      totalCopies: number;
      availableCopies: number;
    }>([
      { $match: { isAvailableForCirculation: true } },
      {
        $group: {
          _id: null,
          totalTitles: { $sum: 1 },
          totalCopies: { $sum: "$totalCopies" },
          availableCopies: { $sum: "$availableCopies" },
        },
      },
    ]),

    // 2. Tổng số đầu sách cạn tồn kho
    bookModel.countDocuments({ availableCopies: 0, isAvailableForCirculation: true }),

    // 3. Danh sách 10 đầu sách cạn tồn kho gần nhất để hiển thị cảnh báo
    bookModel
      .find({ availableCopies: 0, isAvailableForCirculation: true })
      .select("title bookType coverPrice totalCopies availableCopies facultyId")
      .populate("facultyId", "facultyName")
      .limit(10)
      .lean(),

    // 4. Tổng số độc giả trong hệ thống
    readerModel.countDocuments(),

    // 5. Thống kê trạng thái phiếu mượn
    loanRecordModel.countDocuments({ status: "Đang mượn" }),
    loanRecordModel.countDocuments({ status: "Quá hạn" }),
    loanRecordModel.countDocuments({ status: "Chờ nộp phạt" }),

    // 6. Thống kê tài chính phạt (Chờ thanh toán vs Đã thanh toán)
    penaltyRecordModel.aggregate<{
      _id: string;
      totalAmount: number;
      count: number;
    }>([
      {
        $group: {
          _id: "$paymentStatus",
          totalAmount: { $sum: "$totalPenalty" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const bookAggResult = bookStats[0] ?? {
    totalTitles: 0,
    totalCopies: 0,
    availableCopies: 0,
  };

  const unpaidPenalty =
    penaltyAgg.find((p) => p._id === "Chờ thanh toán")?.totalAmount ?? 0;
  const collectedPenalty =
    penaltyAgg.find((p) => p._id === "Đã thanh toán")?.totalAmount ?? 0;

  return {
    books: {
      totalTitles: bookAggResult.totalTitles,
      totalCopies: bookAggResult.totalCopies,
      availableCopies: bookAggResult.availableCopies,
      outOfStockCount,
      outOfStockList: outOfStockBooks,
    },
    readers: {
      totalReaders: activeReadersCount,
    },
    loans: {
      borrowingCount,
      overdueCount,
      pendingPenaltyCount,
    },
    penalties: {
      unpaidPenalty,
      collectedPenalty,
      totalRevenue: collectedPenalty,
    },
  };
};
