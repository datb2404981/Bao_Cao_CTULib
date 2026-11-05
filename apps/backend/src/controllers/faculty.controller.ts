import { RequestHandler } from "express";
import { createFaculty, deleteFaculaty, getAllFaculties, getFacultyById, updateFaculaty } from "../services/faculty.service.js";

export const createFacultyController:RequestHandler = async (req,res,next) => {
  try {
    const data = await createFaculty(req.body);
    res.status(201).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error);
  }
};

export const updateFacultyController:RequestHandler = async (req,res,next) => {
  try {
    const data = await updateFaculaty(req.params.id,req.body);
    res.status(200).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error)
  }
};

export const deletedFacultyController:RequestHandler = async (req,res,next) => {
  try {
    const data = await deleteFaculaty(req.params.id)
    res.status(200).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error)
  }
};

export const getAllFacultiesController:RequestHandler = async (req,res,next) => {
  try {
    const data = await getAllFaculties();
    res.status(200).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error)
  }
};

export const getFacultyController:RequestHandler = async (req,res,next) => {
  try {
    const data = await getFacultyById(req.params.id);
    res.status(200).json({
      status: "success",
      data
    })
  } catch (error) {
    next(error);
  }
};