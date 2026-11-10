import { Router } from "express";
import { createEmployeeController, getAllEmployeesController, getEmployeeController, updateEmployeeController } from "../controllers/employee.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createEmployeeSchema, updateEmployeeSchema } from "../schemas/employee.schema.js";

const employeeRouter = Router();
employeeRouter.use(authenticate, requireAdmin);
employeeRouter.post("/", validate(createEmployeeSchema), createEmployeeController);
employeeRouter.get("/", getAllEmployeesController);
employeeRouter.get("/:id", getEmployeeController);
employeeRouter.patch("/:id", validate(updateEmployeeSchema), updateEmployeeController);
export default employeeRouter;
