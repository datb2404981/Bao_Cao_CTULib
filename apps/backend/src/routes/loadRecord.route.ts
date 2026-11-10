import { Router, type RequestHandler } from "express";
import type { ZodType } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { getAccountAccess } from "../services/access.service.js";
import { AppError } from "../utils/app-error.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createLoanSchema,
  returnLoanSchema,
  loanIdParamsSchema,
  readerIdParamsSchema,
  loanListQuerySchema,
  readerHistoryQuerySchema,
} from "../schemas/loadRecord.schema.js";
import {
  createLoanRecordController,
  approveHandoverLoanRecordController,
  cancelReservationLoanRecordController,
  processReturnLoanRecordController,
  collectPenaltyPaymentController,
  getAllLoanRecordsController,
  getMyLoanHistoryController,
  getReaderLoanHistoryController,
  getLoanPenaltyController,
  getLoanDetailController,
  archiveLoanRecordController,
} from "../controllers/loadRecord.controller.js";

const router = Router();
const staffPermission = requirePermission("MANAGE_LOANS");
const handoverPermission = requirePermission("APPROVE_HANDOVER");
const returnPermission = requirePermission("PROCESS_RETURN");

const validatePart =
  (schema: ZodType, part: "params" | "query"): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[part]);
    if (!parsed.success) {
      return next(
        new AppError(
          "Tham số không hợp lệ: " +
            parsed.error.issues.map((issue) => issue.message).join(", "),
          400,
        ),
      );
    }
    if (part === "params") req.params = parsed.data as Record<string, string>;
    next();
  };

const requireReader: RequestHandler = async (req: AuthenticatedRequest, _res, next) => {
  try {
    if (!req.user) throw new AppError("Chưa đăng nhập", 401);
    const access = await getAccountAccess(req.user.accountId);
    if (access.role !== "READER") throw new AppError("Chỉ độc giả được thực hiện", 403);
    next();
  } catch (error) {
    next(error);
  }
};

const requireReaderOrLoanStaff: RequestHandler = async (
  req: AuthenticatedRequest,
  res,
  next,
) => {
  try {
    if (!req.user) throw new AppError("Chưa đăng nhập", 401);
    const access = await getAccountAccess(req.user.accountId);
    if (access.role === "READER") return next();
    return staffPermission(req, res, next);
  } catch (error) {
    next(error);
  }
};

router.use(authenticate);
router.get(
  "/me",
  requireReader,
  validatePart(readerHistoryQuerySchema, "query"),
  getMyLoanHistoryController,
);
router.get(
  "/reader/:readerId",
  staffPermission,
  validatePart(readerIdParamsSchema, "params"),
  validatePart(readerHistoryQuerySchema, "query"),
  getReaderLoanHistoryController,
);
router.patch(
  "/:loanId/archive",
  staffPermission,
  validatePart(loanIdParamsSchema, "params"),
  archiveLoanRecordController,
);
router.get(
  "/:loanId/penalty",
  requireReaderOrLoanStaff,
  validatePart(loanIdParamsSchema, "params"),
  getLoanPenaltyController,
);
router.patch(
  "/:loanId/handover",
  handoverPermission,
  validatePart(loanIdParamsSchema, "params"),
  approveHandoverLoanRecordController,
);
router.patch(
  "/:loanId/cancel",
  requireReaderOrLoanStaff,
  validatePart(loanIdParamsSchema, "params"),
  cancelReservationLoanRecordController,
);
router.patch(
  "/:loanId/return",
  returnPermission,
  validatePart(loanIdParamsSchema, "params"),
  validate(returnLoanSchema),
  processReturnLoanRecordController,
);
router.patch(
  "/:loanId/penalty/payment",
  staffPermission,
  validatePart(loanIdParamsSchema, "params"),
  collectPenaltyPaymentController,
);
router.get(
  "/",
  requireReaderOrLoanStaff,
  validatePart(loanListQuerySchema, "query"),
  getAllLoanRecordsController,
);
router.post("/", requireReader, validate(createLoanSchema), createLoanRecordController);
router.get(
  "/:loanId",
  requireReaderOrLoanStaff,
  validatePart(loanIdParamsSchema, "params"),
  getLoanDetailController,
);

export default router;
