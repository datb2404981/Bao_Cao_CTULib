import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { publisherSchema } from "../schemas/publisher.schema.js";
import {
  createPublisherController,
  deletePublisherController,
  getAllPublishersController,
  getPublisherController,
  updatePublisherController,
} from "../controllers/publisher.controller.js";

const publisherRouter = Router();

publisherRouter.post(
  "/",
  authenticate,
  requirePermission("MANAGE_PUBLISHERS"),
  validate(publisherSchema),
  createPublisherController
);
publisherRouter.get("/:id", getPublisherController);
publisherRouter.put(
  "/:id",
  authenticate,
  requirePermission("MANAGE_PUBLISHERS"),
  validate(publisherSchema),
  updatePublisherController
);
publisherRouter.delete(
  "/:id",
  authenticate,
  requirePermission("MANAGE_PUBLISHERS"),
  deletePublisherController
);
publisherRouter.get("/", getAllPublishersController);

export default publisherRouter;
