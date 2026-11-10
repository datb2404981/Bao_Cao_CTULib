import { Router, type RequestHandler } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { AppError } from "../utils/app-error.js";
import {
  penaltyIdParamsSchema,
  penaltyListQuerySchema,
  collectPenaltySchema,
} from "../schemas/loadRecord.schema.js";
import {
  getPenaltiesController,
  getPenaltyDetailController,
  collectPenaltyController,
} from "../controllers/penalty.controller.js";

const router = Router();
const validateQuery: RequestHandler = (req, _res, next) => {
  const result = penaltyListQuerySchema.safeParse(req.query);
  if (!result.success)
    return next(new AppError("Tham số lọc phiếu phạt không hợp lệ", 400));
  next();
};
const validateParams: RequestHandler = (req, _res, next) => {
  const result = penaltyIdParamsSchema.safeParse(req.params);
  if (!result.success) return next(new AppError("ID phiếu phạt không hợp lệ", 400));
  next();
};

router.use(authenticate, requirePermission("COLLECT_PENALTY"));
router.get("/", validateQuery, getPenaltiesController);
router.get("/:penaltyId", validateParams, getPenaltyDetailController);
router.patch(
  "/:penaltyId/collect",
  validateParams,
  validate(collectPenaltySchema),
  collectPenaltyController,
);

export default router;
