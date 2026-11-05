import { RequestHandler } from "express";
import { createAuthor, deleteAuthor, getAllAuthors, getAuthorById, updateAuthor } from "../services/author.service.js";

export const createAuthorController:RequestHandler = async (req,res,next) => {
  try {
    const data = await createAuthor(req.body);
    return res.status(201).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error);
  }
};

export const getAuthorController:RequestHandler = async (req,res,next) => {
  try {
    const data = await getAuthorById(req.params.id);
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAuthorController:RequestHandler = async (req,res,next) => {
  try {
    const data = await updateAuthor(req.params.id, req.body);
    return res.status(200).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error);
  }
};

export const deleteAuthorController:RequestHandler = async (req,res,next) => {
  try {
    const data = await deleteAuthor(req.params.id);
    return res.status(200).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error)
  }
};

export const getAllAuthorsController: RequestHandler = async (req,res,next) => {
  try {
    const data = await getAllAuthors();
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (error) {
    next(error);
  }
};