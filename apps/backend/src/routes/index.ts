import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import authRouter from "./auth.route.js";
import bookRouter from "./book.route.js";
import { AUTH_PATH } from "../utils/auth-cookie.util.js";
import facultyRouter from "./faculty.route.js";
import authorRouter from "./author.route.js";

import readerRouter from "./reader.route.js";
import employeeRouter from "./employee.route.js";
import permissionRouter from "./permission.route.js";

const router = Router();

router.get("/health", getHealth);
router.use(AUTH_PATH, authRouter);
router.use("/auth", authRouter);
router.use("/book", bookRouter);
router.use("/faculty", facultyRouter);
router.use("/author", authorRouter);

router.use("/reader", readerRouter);
router.use("/employee", employeeRouter);
router.use("/permission", permissionRouter);

export default router;
