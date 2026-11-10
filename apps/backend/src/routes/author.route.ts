import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { Router } from "express";
import { createAuthorController, deleteAuthorController, getAllAuthorsController, getAuthorController, updateAuthorController } from "../controllers/author.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authorSchema } from "../schemas/author.schema.js";

const authorRouter = Router();

authorRouter.post("/", authenticate, requirePermission("MANAGE_AUTHORS"), validate(authorSchema), createAuthorController);
authorRouter.get("/:id", getAuthorController);
authorRouter.put("/:id", authenticate, requirePermission("MANAGE_AUTHORS"), validate(authorSchema), updateAuthorController);
authorRouter.delete("/:id", authenticate, requirePermission("MANAGE_AUTHORS"), deleteAuthorController);
authorRouter.get("/", getAllAuthorsController);

export default authorRouter;