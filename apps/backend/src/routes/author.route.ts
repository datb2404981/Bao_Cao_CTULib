import { Router } from "express";
import { createAuthorController, deleteAuthorController, updateAuthorController } from "../controllers/author.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authorSchema } from "../schemas/author.schema.js";
import { getAllAuthors, getAuthorById } from "../services/author.service.js";

const authorRouter = Router();

authorRouter.post("/", validate(authorSchema), createAuthorController);
authorRouter.get("/:id", getAuthorById);
authorRouter.put("/:id", validate(authorSchema), updateAuthorController);
authorRouter.delete("/:id", deleteAuthorController);
authorRouter.get("/", getAllAuthors);

export default authorRouter;