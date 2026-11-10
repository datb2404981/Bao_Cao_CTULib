import { Router } from "express";
import { createPermissionController, getAllPermissionsController, getPermissionController, updatePermissionController } from "../controllers/permission.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { permissionSchema, updatePermissionSchema } from "../schemas/permission.schema.js";

const permissionRouter = Router();
permissionRouter.use(authenticate, requireAdmin);
permissionRouter.post("/", validate(permissionSchema), createPermissionController);
permissionRouter.get("/", getAllPermissionsController);
permissionRouter.get("/:id", getPermissionController);
permissionRouter.patch("/:id", validate(updatePermissionSchema), updatePermissionController);
export default permissionRouter;
