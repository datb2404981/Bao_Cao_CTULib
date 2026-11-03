import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import authRouter from "./auth.route.js";
import bookRouter from "./book.route.js";
import { AUTH_PATH } from "../utils/auth-cookie.util.js";

const router = Router();

router.get("/health", getHealth);
router.use(AUTH_PATH, authRouter);
router.use("/books", bookRouter);

export default router;
