import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { getDashboardStatsController } from "../controllers/dashboard.controller.js";

const router = Router();
const staffPermission = requirePermission("MANAGE_LOANS");

router.use(authenticate);
router.get("/stats", staffPermission, getDashboardStatsController);

export default router;
