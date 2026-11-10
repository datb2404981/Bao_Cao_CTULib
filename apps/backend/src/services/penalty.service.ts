import { Types, type FilterQuery } from "mongoose";
import loanRecordModel, { type LoadRecord, type LoanStatus } from "../models/loanRecord.model.js";
import penaltyRecordModel, { type PenaltyRecord } from "../models/penaltyRecord.model.js";
import { AppError } from "../utils/app-error.js";

type LoanEntity = LoadRecord & { _id: Types.ObjectId };
type PenaltyEntity = PenaltyRecord & { _id: Types.ObjectId };

const loanStatuses: Record<LoanStatus, string> = {
  "Đặt lịch mượn": "PENDING",
  "Đang mượn": "BORROWED",
  "Quá hạn": "OVERDUE",
  "Chờ nộp phạt": "FINE_PENDING",
  "Đã trả": "RETURNED",
  "Đã huỷ": "CANCELLED",
};

export const toLoanDetail = (loan: LoanEntity, penalty: PenaltyEntity | null) => {
  const damageRatio = penalty?.damagePercentage ?? (loan.actualReturnDate ? 0 : null);
  const returnCondition = !loan.actualReturnDate ? null
    : loan.returnCondition === "LOST" || loan.returnCondition === "Mất" ? "LOST"
    : damageRatio === 0 ? "GOOD" : "DAMAGED";

  return {
    loanId: loan._id.toString(),
    bookId: loan.bookId.toString(),
    readerAccountId: loan.readerId.toString(),
    status: loanStatuses[loan.status],
    actualReturnDate: loan.actualReturnDate ?? null,
    returnCondition,
    damageRatio,
    penalty: penalty ? {
      penaltyId: penalty._id.toString(),
      totalPenalty: penalty.totalPenalty,
      paymentStatus: penalty.paymentStatus === "Đã thanh toán" ? "PAID" : "PENDING",
      paymentDate: penalty.paymentDate ?? null,
    } : null,
  };
};

// Lấy phạt một lần cho cả trang danh sách, tránh N+1 truy vấn và giữ đúng dữ liệu penalty.
export const toLoanListItems = async (loans: LoanEntity[]) => {
  if (loans.length === 0) return [];
  const penalties = await penaltyRecordModel.find({
    loanRecordId: { $in: loans.map((loan) => loan._id) },
  }).lean();
  const penaltiesByLoanId = new Map(
    penalties.map((penalty) => [penalty.loanRecordId.toString(), penalty]),
  );
  return loans.map((loan) => toLoanDetail(
    loan,
    penaltiesByLoanId.get(loan._id.toString()) ?? null,
  ));
};

export const toPenaltyDetail = (penalty: PenaltyEntity, loan: LoanEntity) => ({
  penaltyId: penalty._id.toString(),
  loanId: loan._id.toString(),
  readerAccountId: loan.readerId.toString(),
  issuedDate: penalty.issuedDate,
  overdueDays: penalty.overdueDays,
  appliedCoverPrice: penalty.appliedCoverPrice,
  damagePercentage: penalty.damagePercentage,
  overdueFee: penalty.overdueFee,
  damageFee: penalty.damageFee,
  totalPenalty: penalty.totalPenalty,
  violationNote: penalty.violationNote ?? null,
  paymentStatus: penalty.paymentStatus === "Đã thanh toán" ? "PAID" : "PENDING",
  paymentDate: penalty.paymentDate ?? null,
  collectorAccountId: penalty.paymentEmployeeId?.toString() ?? null,
  amountCollected: penalty.amountCollected ?? 0,
  paymentMethod: penalty.paymentMethod ?? null,
});

export const getLoanPenalty = async (input: { loanId: string; readerId?: string }) => {
  const loan = await loanRecordModel.findOne({
    _id: input.loanId,
    ...(input.readerId ? { readerId: input.readerId } : {}),
  }).select('_id').lean();
  if (!loan) throw new AppError('Phiếu mượn không tồn tại hoặc không có quyền xem', 404);
  return penaltyRecordModel.findOne({ loanRecordId: loan._id }).lean();
};

export const getLoanDetail = async (input: { loanId: string; readerId?: string }) => {
  const loan = await loanRecordModel.findById(input.loanId).lean();
  if (!loan) throw new AppError("Phiếu mượn không tồn tại", 404);
  if (input.readerId && loan.readerId.toString() !== input.readerId)
    throw new AppError("Bạn không có quyền xem phiếu mượn này", 403);
  const penalty = await penaltyRecordModel.findOne({ loanRecordId: loan._id }).lean();
  return toLoanDetail(loan, penalty);
};

export type PenaltyListInput = {
  page?: number;
  limit?: number;
  paymentStatus?: "PENDING" | "PAID";
  loanId?: string;
  readerAccountId?: string;
};

export const getPenalties = async (input: PenaltyListInput = {}) => {
  const page = input.page ?? 1;
  const limit = input.limit ?? 10;
  const filter: FilterQuery<PenaltyRecord> = {};

  if (input.paymentStatus) {
    filter.paymentStatus = input.paymentStatus === "PAID" ? "Đã thanh toán" : "Chờ thanh toán";
  }
  if (input.loanId) filter.loanRecordId = new Types.ObjectId(input.loanId);
  if (input.readerAccountId) {
    const loansForReader = await loanRecordModel.find({
      readerId: new Types.ObjectId(input.readerAccountId),
    }).select("_id").lean();
    const ids = loansForReader.map(loan => loan._id);
    filter.loanRecordId = input.loanId
      ? { $in: ids.filter(id => id.toString() === input.loanId) }
      : { $in: ids };
  }

  const [penalties, totalItems] = await Promise.all([
    penaltyRecordModel.find(filter)
      .sort({ issuedDate: -1, _id: 1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    penaltyRecordModel.countDocuments(filter),
  ]);
  const loans = await loanRecordModel.find({
    _id: { $in: penalties.map(penalty => penalty.loanRecordId) },
  }).lean();
  const byId = new Map(loans.map(loan => [loan._id.toString(), loan]));
  const items = penalties.map(penalty => {
    const loan = byId.get(penalty.loanRecordId.toString());
    if (!loan) throw new AppError("Phiếu phạt tham chiếu phiếu mượn không tồn tại", 409);
    return toPenaltyDetail(penalty, loan);
  });
  return { items, meta: {
    totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: page, limit,
  } };
};

export const getPenaltyDetail = async (penaltyId: string) => {
  const penalty = await penaltyRecordModel.findById(penaltyId).lean();
  if (!penalty) throw new AppError("Phiếu phạt không tồn tại", 404);
  const loan = await loanRecordModel.findById(penalty.loanRecordId).lean();
  if (!loan) throw new AppError("Phiếu mượn không tồn tại", 404);
  return toPenaltyDetail(penalty, loan);
};
