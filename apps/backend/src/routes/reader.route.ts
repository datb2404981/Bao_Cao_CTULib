import { Router } from "express";
import { createReaderController, getAllReadersController, getReaderController, updateReaderController, borrowingBlockController } from "../controllers/reader.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createReaderSchema, updateReaderSchema, borrowingBlockSchema } from "../schemas/reader.schema.js";

const readerRouter = Router();
readerRouter.use(authenticate, requireAdmin);
readerRouter.post("/", validate(createReaderSchema), createReaderController);
readerRouter.get("/", getAllReadersController);
readerRouter.get("/:id", getReaderController);
readerRouter.patch("/:id/borrowing-block", validate(borrowingBlockSchema), borrowingBlockController);
readerRouter.patch("/:id", validate(updateReaderSchema), updateReaderController);
export default readerRouter;
