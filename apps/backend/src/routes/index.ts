import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import authRouter from "./auth.route.js";
import bookRouter from "./book.route.js";
import { AUTH_PATH } from "../utils/auth-cookie.util.js";
import facultyRouter from "./faculty.route.js";

const router = Router();

router.get("/health", getHealth);
router.use(AUTH_PATH, authRouter);
router.use("/auth", authRouter);
router.use("/book", bookRouter);
router.use("/books", bookRouter);
router.use("/api/v1/books", bookRouter);
router.use("/faculty", facultyRouter);
router.use("/faculties", facultyRouter);
router.use("/api/v1/faculties", facultyRouter);

export default router;
