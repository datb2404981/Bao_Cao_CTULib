import { Router } from "express";
import {
  createBookController,
  deleteBookController,
  getAllBooksController,
  getBookByIdController,
  updateBookController,
} from "../controllers/book.controller.js";
import {
  authenticate,
  requireManageBooks,
} from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { bookSchema } from "../schemas/book.schema.js";

const bookRouter = Router();

bookRouter.get("/", getAllBooksController);
bookRouter.post(
  "/",
  authenticate,
  requireManageBooks,
  validate(bookSchema),
  createBookController,
);
bookRouter.get("/:bookId", authenticate, getBookByIdController);
bookRouter.put("/:bookId", authenticate, requireManageBooks, updateBookController);
bookRouter.delete("/:bookId", authenticate, requireManageBooks, deleteBookController);

export default bookRouter;
