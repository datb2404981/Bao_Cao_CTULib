import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateAccountSchema } from '../schemas/account.schema.js';
import { listAccountsController, updateAccountController } from '../controllers/account.controller.js';

const router = Router();
router.use(authenticate, requireAdmin);
router.get('/', listAccountsController);
router.patch('/:id', validate(updateAccountSchema), updateAccountController);
export default router;
