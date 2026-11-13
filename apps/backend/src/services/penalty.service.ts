import { Types, type FilterQuery } from "mongoose";
import loanRecordModel, { type LoadRecord, type LoanStatus } from "../models/loanRecord.model.js";
import penaltyRecordModel, { type PenaltyRecord } from "../models/penaltyRecord.model.js";
import bookModel from "../models/book.model.js";
import readerModel from "../models/reader.model.js";
import { AccountModel } from "../models/user.model.js";
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
    _id: loan._id.toString(),
    bookId: loan.bookId.toString(),
    readerAccountId: loan.readerId.toString(),
    readerId: loan.readerId.toString(),
    status: loanStatuses[loan.status],
    reservationDate: loan.reservationDate ? loan.reservationDate.toISOString() : null,
    reservationExpiryDate: loan.reservationExpiryDate ? loan.reservationExpiryDate.toISOString() : null,
    handoverDate: loan.handoverDate ? loan.handoverDate.toISOString() : null,
    dueDate: loan.dueDate ? loan.dueDate.toISOString() : null,
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

type PenaltyDisplayMeta = {
  readerCode?: string;
  readerName?: string;
  bookTitle?: string;
  collectorCode?: string;
};

export const toPenaltyDetail = (
  penalty: PenaltyEntity,
  loan: LoanEntity,
  meta: PenaltyDisplayMeta = {},
) => ({
  penaltyId: penalty._id.toString(),
  loanId: loan._id.toString(),
  readerAccountId: loan.readerId.toString(),
  ...(meta.readerCode ? { readerCode: meta.readerCode } : {}),
  ...(meta.readerName ? { readerName: meta.readerName } : {}),
  ...(meta.bookTitle ? { bookTitle: meta.bookTitle } : {}),
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
  ...(meta.collectorCode ? { collectorCode: meta.collectorCode } : {}),
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

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type PenaltyListInput = {
  page?: number;
  limit?: number;
  paymentStatus?: "PENDING" | "PAID";
  loanId?: string;
  readerAccountId?: string;
  readerCode?: string;
  bookTitle?: string;
};

export const getPenalties = async (input: PenaltyListInput = {}) => {
  const page = input.page ?? 1;
  const limit = input.limit ?? 10;
  const filter: FilterQuery<PenaltyRecord> = {};

  if (input.paymentStatus) {
    filter.paymentStatus = input.paymentStatus === "PAID" ? "Đã thanh toán" : "Chờ thanh toán";
  }

  let allowedLoanIds: Types.ObjectId[] | null = input.loanId
    ? [new Types.ObjectId(input.loanId)]
    : null;

  const intersectLoanIds = (nextIds: Types.ObjectId[]) => {
    if (allowedLoanIds === null) {
      allowedLoanIds = nextIds;
      return;
    }
    const nextSet = new Set(nextIds.map((id) => id.toString()));
    allowedLoanIds = allowedLoanIds.filter((id) => nextSet.has(id.toString()));
  };

  if (input.readerAccountId) {
    const loansForReader = await loanRecordModel
      .find({ readerId: new Types.ObjectId(input.readerAccountId) })
      .select("_id")
      .lean();
    intersectLoanIds(loansForReader.map((loan) => loan._id));
  }

  if (input.readerCode?.trim()) {
    const matchedAccounts = await AccountModel.find({
      ctuIdentifier: new RegExp(escapeRegex(input.readerCode.trim()), "i"),
    })
      .select("_id")
      .lean();
    if (matchedAccounts.length === 0) {
      return { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: page, limit } };
    }
    const loansForCode = await loanRecordModel
      .find({ readerId: { $in: matchedAccounts.map((acc) => acc._id) } })
      .select("_id")
      .lean();
    intersectLoanIds(loansForCode.map((loan) => loan._id));
  }

  if (input.bookTitle?.trim()) {
    const matchedBooks = await bookModel
      .find({ title: new RegExp(escapeRegex(input.bookTitle.trim()), "i") })
      .select("_id")
      .lean();
    if (matchedBooks.length === 0) {
      return { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: page, limit } };
    }
    const loansForBook = await loanRecordModel
      .find({ bookId: { $in: matchedBooks.map((book) => book._id) } })
      .select("_id")
      .lean();
    intersectLoanIds(loansForBook.map((loan) => loan._id));
  }

  if (allowedLoanIds !== null) {
    if (allowedLoanIds.length === 0) {
      return { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: page, limit } };
    }
    filter.loanRecordId = { $in: allowedLoanIds };
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

  const readerIds = Array.from(new Set(loans.map((l) => l.readerId.toString())));
  const collectorIds = Array.from(
    new Set(penalties.map((p) => p.paymentEmployeeId?.toString()).filter((id): id is string => !!id)),
  );
  const accountIds = Array.from(new Set([...readerIds, ...collectorIds]));
  const bookIds = Array.from(new Set(loans.map((l) => l.bookId.toString())));

  const [accounts, readers, books] = penalties.length
    ? await Promise.all([
        AccountModel.find({ _id: { $in: accountIds } }).select("_id ctuIdentifier").lean(),
        readerModel.find({ _id: { $in: readerIds } }).select("_id fullName").lean(),
        bookModel.find({ _id: { $in: bookIds } }).select("_id title").lean(),
      ])
    : [[], [], []];

  const accountById = new Map(accounts.map((a) => [String(a._id), a.ctuIdentifier]));
  const readerById = new Map(readers.map((r) => [String(r._id), r.fullName ?? undefined]));
  const bookById = new Map(books.map((b) => [String(b._id), b.title]));

  const items = penalties.map(penalty => {
    const loan = byId.get(penalty.loanRecordId.toString());
    if (!loan) throw new AppError("Phiếu phạt tham chiếu phiếu mượn không tồn tại", 409);
    return toPenaltyDetail(penalty, loan, {
      readerCode: accountById.get(loan.readerId.toString()),
      readerName: readerById.get(loan.readerId.toString()),
      bookTitle: bookById.get(loan.bookId.toString()),
      collectorCode: penalty.paymentEmployeeId
        ? accountById.get(penalty.paymentEmployeeId.toString())
        : undefined,
    });
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

  const accountIds = [loan.readerId, ...(penalty.paymentEmployeeId ? [penalty.paymentEmployeeId] : [])];
  const [accounts, reader, book] = await Promise.all([
    AccountModel.find({ _id: { $in: accountIds } }).select("_id ctuIdentifier").lean(),
    readerModel.findById(loan.readerId).select("fullName").lean(),
    bookModel.findById(loan.bookId).select("title").lean(),
  ]);
  const accountById = new Map(accounts.map((a) => [String(a._id), a.ctuIdentifier]));

  return toPenaltyDetail(penalty, loan, {
    readerCode: accountById.get(loan.readerId.toString()),
    readerName: reader?.fullName ?? undefined,
    bookTitle: book?.title,
    collectorCode: penalty.paymentEmployeeId
      ? accountById.get(penalty.paymentEmployeeId.toString())
      : undefined,
  });
};
