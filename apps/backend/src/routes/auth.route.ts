import { Router } from "express";
import { loginController, logoutController, refreshController, registerController } from "../controllers/user.controller.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import { validate } from "../middlewares/validate.middleware.js";

import { authNoStore, requireTrustedOrigin, validateSessionRequest } from "../middlewares/auth-session.middleware.js";

const authRouter = Router();
authRouter.use(authNoStore);

authRouter.post("/register", validate(registerSchema), registerController);
authRouter.post("/login", requireTrustedOrigin, validate(loginSchema), loginController);
authRouter.post("/refresh", requireTrustedOrigin, validateSessionRequest, refreshController);
authRouter.post("/logout", requireTrustedOrigin, validateSessionRequest, logoutController);

export default authRouter;
