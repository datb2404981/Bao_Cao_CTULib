import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { AppError } from "../utils/app-error.js";
import { getPenalties, getPenaltyDetail, toLoanDetail, toPenaltyDetail } from "../services/penalty.service.js";
import { collectPenaltyPayment } from "../services/loadRecord.service.js";
import { penaltyListQuerySchema } from "../schemas/loadRecord.schema.js";

export const getPenaltiesController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getPenalties(penaltyListQuerySchema.parse(req.query));
    res.json({ status: "success", message: "Lấy danh sách phiếu phạt thành công", data });
  } catch (error) { next(error); }
};

export const getPenaltyDetailController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getPenaltyDetail(req.params.penaltyId);
    res.json({ status: "success", message: "Lấy chi tiết phiếu phạt thành công", data });
  } catch (error) { next(error); }
};

export const collectPenaltyController: RequestHandler = async (
  req: AuthenticatedRequest, res, next,
) => {
  try {
    if (!req.user) throw new AppError("Chưa đăng nhập", 401);
    const result = await collectPenaltyPayment({
      penaltyId: req.params.penaltyId,
      employeeId: req.user.accountId,
      expectedTotalPenalty: req.body.expectedTotalPenalty,
    });
    res.json({
      status: "success",
      message: "Đã ghi nhận thu đủ tiền phạt",
      data: {
        penalty: toPenaltyDetail(result.penalty, result.loan),
        loan: toLoanDetail(result.loan, result.penalty),
        isBorrowingBlocked: result.isBorrowingBlocked,
      },
    });
  } catch (error) { next(error); }
};
