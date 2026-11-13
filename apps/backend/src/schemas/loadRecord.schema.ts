import { z } from "zod";
import { LOAN_STATUSES, type LoanStatus } from "../models/loanRecord.model.js";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "ID không hợp lệ");
const numericPage = z.coerce.number().int().min(1);

export const loanIdParamsSchema = z.object({ loanId: objectId }).strict();
export const readerIdParamsSchema = z.object({ readerId: objectId }).strict();
export const createLoanSchema = z.object({ bookId: objectId }).strict();
const legacyReturnLoanSchema = z.object({
  damagePercentage: z.number().finite().min(0).max(100),
  returnCondition: z.string().trim().min(1).max(300).optional(),
}).strict();
const goodReturnSchema = z.object({
  condition: z.literal("GOOD"),
}).strict();
const damagedReturnSchema = z.object({
  condition: z.literal("DAMAGED"),
  damageRatio: z.number().int().min(1).max(100),
  violationNote: z.string().trim().min(1).max(300),
}).strict();
const lostReturnSchema = z.object({
  condition: z.literal("LOST"),
  violationNote: z.string().trim().min(1).max(300),
}).strict();
export const returnLoanSchema = z.union([
  z.discriminatedUnion("condition", [goodReturnSchema, damagedReturnSchema, lostReturnSchema]),
  legacyReturnLoanSchema,
]);
export const penaltyIdParamsSchema = z.object({ penaltyId: objectId }).strict();
export const penaltyListQuerySchema = z.object({
  page: numericPage.optional(),
  limit: numericPage.max(100).optional(),
  paymentStatus: z.enum(["PENDING", "PAID"]).optional(),
  loanId: objectId.optional(),
  readerAccountId: objectId.optional(),
  readerCode: z.string().trim().min(1).max(64).optional(),
  bookTitle: z.string().trim().min(1).max(200).optional(),
}).strict();
export const collectPenaltySchema = z.object({
  confirmFullCashReceived: z.literal(true),
  expectedTotalPenalty: z.number().finite().positive(),
}).strict();
// API công khai dùng enum tiếng Anh; frontend cũ vẫn lọc theo trạng thái tiếng Việt.
const apiStatusToDb = {
  PENDING: "Đặt lịch mượn",
  BORROWED: "Đang mượn",
  OVERDUE: "Quá hạn",
  FINE_PENDING: "Chờ nộp phạt",
  RETURNED: "Đã trả",
  CANCELLED: "Đã huỷ",
} as const satisfies Record<string, LoanStatus>;
const loanQueryStatus = z.union([
  z.enum(LOAN_STATUSES),
  z.enum(Object.keys(apiStatusToDb) as [keyof typeof apiStatusToDb, ...Array<keyof typeof apiStatusToDb>]),
]).transform((status): LoanStatus => apiStatusToDb[status as keyof typeof apiStatusToDb] ?? status as LoanStatus);
export const loanListQuerySchema = z.object({
  page: numericPage.optional(),
  limit: numericPage.max(100).optional(),
  status: loanQueryStatus.optional(),
  readerId: objectId.optional(),
  readerCode: z.string().trim().min(1).max(64).optional(),
  bookId: objectId.optional(),
  bookTitle: z.string().trim().min(1).max(200).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
}).strict().refine(
  (value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate,
  { message: "Khoảng ngày không hợp lệ" },
);
export const readerHistoryQuerySchema = z.object({
  page: numericPage.optional(),
  limit: numericPage.max(100).optional(),
  status: z.enum(LOAN_STATUSES).optional(),
  bookId: objectId.optional(),
  bookTitle: z.string().trim().min(1).max(200).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
}).strict().refine(
  (value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate,
  { message: "Khoảng ngày không hợp lệ" },
);
