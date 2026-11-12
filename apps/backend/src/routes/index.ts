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
libraryApiRouter.use("/book", bookRouter);
libraryApiRouter.use("/faculty", facultyRouter);
libraryApiRouter.use("/author", authorRouter);

libraryApiRouter.use("/reader", readerRouter);
libraryApiRouter.use("/employee", employeeRouter);
libraryApiRouter.use("/permission", permissionRouter);
libraryApiRouter.use("/account", accountRouter);
libraryApiRouter.use("/config", systemConfigRouter);

router.use(libraryApiRouter);
router.use("/api/v1", libraryApiRouter);

export default router;
