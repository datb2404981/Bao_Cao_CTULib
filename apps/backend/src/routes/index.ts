import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import authRouter from "./auth.route.js";

import { AUTH_PATH } from "../utils/auth-cookie.util.js";

const router = Router();

router.get("/health", getHealth);
router.use(AUTH_PATH, authRouter);
export default router;
