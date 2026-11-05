import { Router } from "express";
import { createAuthorController, deleteAuthorController, getAllAuthorsController, getAuthorController, updateAuthorController } from "../controllers/author.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authorSchema } from "../schemas/author.schema.js";

const authorRouter = Router();

authorRouter.post("/", validate(authorSchema), createAuthorController);
authorRouter.get("/:id", getAuthorController);
authorRouter.put("/:id", validate(authorSchema), updateAuthorController);
authorRouter.delete("/:id", deleteAuthorController);
authorRouter.get("/", getAllAuthorsController);

export default authorRouter;