import { Router } from "express";
import {
  createSystemConfigHandlerController,
  getAllSystemConfigsController,
  updateSystemConfigHandlerController,
} from "../controllers/systemConfig.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createSystemConfigSchema, updateSystemConfigSchema } from "../schemas/systemConfig.schema.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/", getAllSystemConfigsController);
router.put("/:key", (req, res, next) => {
  validate(updateSystemConfigSchema(req.params.key))(req, res, next);
}, updateSystemConfigHandlerController);
router.post("/", validate(createSystemConfigSchema), createSystemConfigHandlerController);

export default router;
