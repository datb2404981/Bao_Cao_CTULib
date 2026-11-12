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
import loadRecordRouter from "./loadRecord.route.js";
import penaltyRouter from "./penalty.route.js";
import dashboardRouter from "./dashboard.route.js";
import accountRouter from './account.route.js';
import systemConfigRouter from './systemConfig.route.js'

const router = Router();
const libraryApiRouter = Router();

libraryApiRouter.use("/loans", loadRecordRouter);
libraryApiRouter.use("/penalties", penaltyRouter);
libraryApiRouter.use("/dashboard", dashboardRouter);

router.get("/health", getHealth);
router.use(AUTH_PATH, authRouter);
router.use("/auth", authRouter);
router.use("/book", bookRouter);
router.use("/faculty", facultyRouter);
router.use("/author", authorRouter);

router.use("/reader", readerRouter);
router.use("/employee", employeeRouter);
router.use("/permission", permissionRouter);
router.use(libraryApiRouter);
router.use("/api/v1", libraryApiRouter);
router.use('/account', accountRouter);
router.use("/config", systemConfigRouter);

export default router;
