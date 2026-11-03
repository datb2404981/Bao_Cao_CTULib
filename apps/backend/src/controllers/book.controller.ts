import { RequestHandler } from "express";
import {
  createBook,
  deleteBook,
  getAllBooks,
  getBookById,
  updateBook,
} from "../services/book.service.js";

export const createBookController: RequestHandler = async (req, res, next) => {
  try {
    const data = await createBook(req.body);
    res.status(201).json({
      status: "success",
      message: "Thêm thành công",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllBooksController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getAllBooks(req.query);
    res.status(200).json({
      status: "success",
      message: "Lấy danh sách thành công",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookByIdController: RequestHandler = async (req, res, next) => {
  try {
    const bookId = req.params.bookId || req.params.id;
    const data = await getBookById(bookId);
    res.status(200).json({
      status: "success",
      message: "Chi tiết ấn phẩm",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBookController: RequestHandler = async (req, res, next) => {
  try {
    const bookId = req.params.bookId || req.params.id;
    const data = await updateBook(bookId, req.body);
    res.status(200).json({
      status: "success",
      message: "Cập nhật thành công",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBookController: RequestHandler = async (req, res, next) => {
  try {
    const bookId = req.params.bookId || req.params.id;
    await deleteBook(bookId);
    res.status(200).json({
      status: "success",
      message: "Xóa thành công",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
