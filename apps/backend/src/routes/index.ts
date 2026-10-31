import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import { loginController } from "../controllers/user.controller.js";

const router = Router();

router.get("/health", getHealth);

router.route("/auth/login").post(loginController);
export default router;
