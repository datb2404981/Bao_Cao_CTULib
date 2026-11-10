import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { AppError } from "../utils/app-error.js";
import { getAccountAccess } from "../services/access.service.js";
import {
  createLoanRecord,
  approveHandoverLoanRecord,
  cancelReservationLoanRecord,
  processReturnLoanRecord,
  collectPenaltyPayment,
  getAllLoanRecords,
  getReaderLoanHistory,
  archiveLoanRecord,
} from "../services/loadRecord.service.js";
import {
  loanListQuerySchema,
  readerHistoryQuerySchema,
} from "../schemas/loadRecord.schema.js";
import { getLoanPenalty, getLoanDetail, toLoanDetail, toLoanListItems } from "../services/penalty.service.js";

const accountId = (req: AuthenticatedRequest): string => {
  if (!req.user) throw new AppError("Chưa đăng nhập", 401);
  return req.user.accountId;
};

export const createLoanRecordController: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    const data = await createLoanRecord({
      readerId: accountId(req),
      bookId: req.body.bookId,
    });
    res.status(201).json({
      status: "success",
      message: "Đặt lịch mượn thành công",
      data: toLoanDetail(data, null),
    });
  } catch (error) {
    next(error);
  }
};

export const approveHandoverLoanRecordController: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    const data = await approveHandoverLoanRecord({
      loanId: req.params.loanId,
      employeeId: accountId(req),
    });
    res.json({ status: "success", message: "Bàn giao sách thành công", data: toLoanDetail(data, null) });
  } catch (error) {
    next(error);
  }
};

export const cancelReservationLoanRecordController: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    const callerId = accountId(req);
    const access = await getAccountAccess(callerId);
    const data = await cancelReservationLoanRecord({
      loanId: req.params.loanId,
      ...(access.role === "READER" ? { cancelledByReaderId: callerId } : {}),
    });
    res.json({ status: "success", message: "Hủy đặt giữ chỗ thành công", data: toLoanDetail(data, null) });
  } catch (error) {
    next(error);
  }
};

export const processReturnLoanRecordController: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    const modernPayload = "condition" in req.body;
    const damagePercentage = modernPayload
      ? req.body.condition === "GOOD" ? 0 : req.body.condition === "LOST" ? 100 : req.body.damageRatio
      : req.body.damagePercentage;
    const data = await processReturnLoanRecord({
      loanId: req.params.loanId,
      employeeId: accountId(req),
      damagePercentage,
      ...(modernPayload ? {
        returnCondition: req.body.condition,
        ...(req.body.violationNote ? { violationNote: req.body.violationNote } : {}),
      } : { returnCondition: req.body.returnCondition }),
    });
    res.json({
      status: "success",
      ...(modernPayload ? { message: "Đã nhận trả và lập phiếu phạt khi có vi phạm" } : {}),
      data: modernPayload ? toLoanDetail(data.loan, data.penaltyRecord) : data,
    });
  } catch (error) {
    next(error);
  }
};

export const getLoanDetailController: RequestHandler = async (
  req: AuthenticatedRequest, res, next,
) => {
  try {
    const callerId = accountId(req);
    const access = await getAccountAccess(callerId);
    const data = await getLoanDetail({
      loanId: req.params.loanId,
      ...(access.role === "READER" ? { readerId: callerId } : {}),
    });
    res.json({ status: "success", message: "Lấy chi tiết phiếu thành công", data });
  } catch (error) { next(error); }
};

export const collectPenaltyPaymentController: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    const data = await collectPenaltyPayment({
      loanId: req.params.loanId,
      employeeId: accountId(req),
    });
    res.json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const getLoanPenaltyController: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    const callerId = accountId(req);
    const access = await getAccountAccess(callerId);
    const data = await getLoanPenalty({
      loanId: req.params.loanId,
      ...(access.role === "READER" ? { readerId: callerId } : {}),
    });
    res.json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const getAllLoanRecordsController: RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const callerId = accountId(req);
    const access = await getAccountAccess(callerId);
    const query = loanListQuerySchema.parse(req.query);
    // Bỏ readerId do client gửi khi người gọi là độc giả để chống xem lén.
    const page = access.role === "READER"
      ? await getReaderLoanHistory({ ...query, readerId: callerId })
      : await getAllLoanRecords(query);
    const items = await toLoanListItems(page.records);
    res.json({
      status: "success",
      message: "Thành công",
      data: {
        ...page,
        items,
        meta: {
          totalItems: page.pagination.total,
          totalPages: page.pagination.totalPages,
          currentPage: page.pagination.page,
          limit: page.pagination.limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyLoanHistoryController: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    const data = await getReaderLoanHistory({
      ...readerHistoryQuerySchema.parse(req.query),
      readerId: accountId(req),
    });
    res.json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const getReaderLoanHistoryController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getReaderLoanHistory({
      ...readerHistoryQuerySchema.parse(req.query),
      readerId: req.params.readerId,
    });
    res.json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const archiveLoanRecordController: RequestHandler = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const result = await archiveLoanRecord(loanId);
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};
