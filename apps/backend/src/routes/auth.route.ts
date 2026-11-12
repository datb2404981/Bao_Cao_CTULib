import { Router } from "express";
import { loginController, logoutController, refreshController, registerController } from "../controllers/user.controller.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import { validate } from "../middlewares/validate.middleware.js";

import { authNoStore, requireTrustedOrigin, validateSessionRequest } from "../middlewares/auth-session.middleware.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { getAccountAccess } from "../services/access.service.js";
import { AppError } from "../utils/app-error.js";
import { z } from "zod";
import { getOwnProfile, updateOwnEmail, updateOwnPersonalInfo } from "../services/profile.service.js";

const authRouter = Router();
authRouter.use(authNoStore);

const emailSchema = z.object({ email: z.string().trim().email('Email không đúng định dạng').max(254) }).strict();
const personalSchema = z.object({
  fullName: z.string().trim().min(2).max(50),
  phoneNumber: z.string().trim().max(30),
  address: z.string().trim().max(250),
}).strict();

authRouter.get('/profile', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ status: 'success', data: await getOwnProfile(req.user!.accountId) }); } catch (error) { next(error); }
});
authRouter.patch('/profile/email', authenticate, validate(emailSchema), async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ status: 'success', data: await updateOwnEmail(req.user!.accountId, req.body.email) }); } catch (error) { next(error); }
});
authRouter.patch('/profile/personal', authenticate, validate(personalSchema), async (req: AuthenticatedRequest, res, next) => {
  try { res.json({ status: 'success', data: await updateOwnPersonalInfo(req.user!.accountId, req.body) }); } catch (error) { next(error); }
});

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
