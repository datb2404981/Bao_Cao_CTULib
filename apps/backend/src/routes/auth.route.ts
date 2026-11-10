import { Router } from "express";
import { loginController, logoutController, refreshController, registerController } from "../controllers/user.controller.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import { validate } from "../middlewares/validate.middleware.js";

import { authNoStore, requireTrustedOrigin, validateSessionRequest } from "../middlewares/auth-session.middleware.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { getAccountAccess } from "../services/access.service.js";
import { AppError } from "../utils/app-error.js";

const authRouter = Router();
authRouter.use(authNoStore);

authRouter.get("/me", authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) throw new AppError("Chưa đăng nhập", 401);
    res.json({ status: "success", data: await getAccountAccess(req.user.accountId) });
  } catch (error) { next(error); }
});

authRouter.post("/register", validate(registerSchema), registerController);
authRouter.post("/login", requireTrustedOrigin, validate(loginSchema), loginController);
authRouter.post("/refresh", requireTrustedOrigin, validateSessionRequest, refreshController);
authRouter.post("/logout", requireTrustedOrigin, validateSessionRequest, logoutController);

export default authRouter;
