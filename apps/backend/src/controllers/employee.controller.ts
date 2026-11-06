import type { RequestHandler } from "express";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
} from "../services/employee.service.js";

export const createEmployeeController: RequestHandler = async (req, res, next) => {
  try {
    const data = await createEmployee(req.body);
    res.status(201).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const getAllEmployeesController: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getAllEmployees();
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const getEmployeeController: RequestHandler = async (req, res, next) => {
  try {
    const data = await getEmployeeById(req.params.id);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
export const updateEmployeeController: RequestHandler = async (req, res, next) => {
  try {
    const data = await updateEmployee(req.params.id, req.body);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
