import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { facultySchema } from "../schemas/faculty.schema.js";
import { createFacultyController, deletedFacultyController, getAllFacultiesController, getFacultyController, updateFacultyController } from "../controllers/faculty.controller.js";

const facultyRouter = Router();

facultyRouter.post("/", authenticate, requirePermission("MANAGE_FACULTIES"), validate(facultySchema), createFacultyController);
facultyRouter.get("/", getAllFacultiesController);
facultyRouter.get("/:id", getFacultyController);
facultyRouter.put("/:id", authenticate, requirePermission("MANAGE_FACULTIES"), validate(facultySchema), updateFacultyController);
facultyRouter.delete("/:id", authenticate, requirePermission("MANAGE_FACULTIES"), deletedFacultyController);

export default facultyRouter;

