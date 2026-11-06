import type { RequestHandler } from "express";
import {
  createReader,
  getAllReaders,
  getReaderById,
  updateReader,
} from "../services/reader.service.js";

export const createReaderController: RequestHandler = async (req, res, next) => {
  try {
    const data = await createReader(req.body);
    res.status(201).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const getAllReadersController: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getAllReaders();
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const getReaderController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getReaderById(req.params.id);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const updateReaderController: RequestHandler = async (req, res, next) => {
  try {
    const data = await updateReader(req.params.id, req.body);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
