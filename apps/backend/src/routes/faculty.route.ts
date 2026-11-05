import { Router } from "express";
import { validate } from "../middlewares/validate.middleware.js";
import { facultySchema } from "../schemas/faculty.schema.js";
import { createFacultyController, deletedFacultyController, getAllFacultiesController, getFacultyController, updateFacultyController } from "../controllers/faculty.controller.js";

const facultyRouter = Router();

facultyRouter.post("/", validate(facultySchema), createFacultyController);
facultyRouter.get("/", getAllFacultiesController);
facultyRouter.get("/:id", getFacultyController);
facultyRouter.put("/:id", validate(facultySchema), updateFacultyController);
facultyRouter.delete("/:id", deletedFacultyController);

export default facultyRouter;

