import { RequestHandler } from "express";
import {
  createPublisher,
  deletePublisher,
  getAllPublishers,
  getPublisherById,
  updatePublisher,
} from "../services/publisher.service.js";

export const createPublisherController: RequestHandler = async (req, res, next) => {
  try {
    const data = await createPublisher(req.body);
    return res.status(201).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublisherController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getPublisherById(req.params.id);
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePublisherController: RequestHandler = async (req, res, next) => {
  try {
    const data = await updatePublisher(req.params.id, req.body);
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePublisherController: RequestHandler = async (req, res, next) => {
  try {
    const data = await deletePublisher(req.params.id);
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPublishersController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getAllPublishers();
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};
